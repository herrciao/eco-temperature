"""Ridge regression: fit growth/inflation/liquidity/risk → SPY forward returns.

Coefficients are estimated on the train split (first TRAIN_FRAC of non-NaN rows)
and applied to the full panel to avoid look-ahead bias in the signal.
"""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from config import RIDGE_ALPHA, TRAIN_FRAC

FACTOR_COLS = ["growth_score", "inflation_score", "liquidity_score", "risk_score"]
HORIZONS = {"4w": 4, "13w": 13}


# ---------------------------------------------------------------------------
# Forward returns
# ---------------------------------------------------------------------------

def compute_spy_forward_returns(df: pd.DataFrame) -> pd.DataFrame:
    """Add spy_fwd_4w and spy_fwd_13w (percentage) to df."""
    out = df.copy()
    if "etf_spy" not in out.columns:
        out["spy_fwd_4w"] = np.nan
        out["spy_fwd_13w"] = np.nan
        return out
    price = out["etf_spy"]
    out["spy_fwd_4w"] = price.shift(-4) / price - 1.0
    out["spy_fwd_13w"] = price.shift(-13) / price - 1.0
    return out


# ---------------------------------------------------------------------------
# Ridge helpers (pure numpy, no scikit-learn dependency)
# ---------------------------------------------------------------------------

def _ridge_fit(X: np.ndarray, y: np.ndarray, alpha: float) -> tuple[np.ndarray, float]:
    """Return (beta_no_intercept, intercept) via closed-form Ridge.

    Centres X and y so the intercept is just the mean of y.
    Falls back to least-squares (lstsq) if the normal equations are numerically
    ill-conditioned.
    """
    y_mean = float(y.mean())
    X_mean = X.mean(axis=0)
    Xc = X - X_mean
    yc = y - y_mean
    n_feat = Xc.shape[1]
    A = Xc.T @ Xc + alpha * np.eye(n_feat)
    try:
        beta = np.linalg.solve(A, Xc.T @ yc)
        if not np.all(np.isfinite(beta)):
            raise np.linalg.LinAlgError("non-finite beta")
    except np.linalg.LinAlgError:
        # Fallback: penalised least-squares via lstsq on augmented system
        aug_X = np.vstack([Xc, np.sqrt(alpha) * np.eye(n_feat)])
        aug_y = np.concatenate([yc, np.zeros(n_feat)])
        beta, _, _, _ = np.linalg.lstsq(aug_X, aug_y, rcond=None)
    intercept = y_mean - X_mean @ beta
    return beta, intercept


def _r2(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    ss_res = float(np.sum((y_true - y_pred) ** 2))
    ss_tot = float(np.sum((y_true - y_true.mean()) ** 2))
    if ss_tot == 0:
        return 0.0
    return 1.0 - ss_res / ss_tot


def _spearman_ic(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Spearman rank correlation between predicted composite and forward return."""
    if len(y_true) < 4:
        return float("nan")
    rank_true = pd.Series(y_true).rank()
    rank_pred = pd.Series(y_pred).rank()
    corr = float(np.corrcoef(rank_true, rank_pred)[0, 1])
    return corr


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def fit_spy_composite(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Fit Ridge regression for each horizon; return (enriched_df, stats_dict).

    stats_dict keys
    ---------------
    For each horizon h in {'4w', '13w'}:
        coef_{h}      : dict factor → coefficient
        intercept_{h} : float
        r2_train_{h}  : float
        r2_test_{h}   : float
        ic_train_{h}  : float (Spearman)
        ic_test_{h}   : float (Spearman)
    """
    out = compute_spy_forward_returns(df.copy())
    stats: dict[str, Any] = {}

    available_factors = [c for c in FACTOR_COLS if c in out.columns]
    if not available_factors:
        return out, stats

    for label, weeks in HORIZONS.items():
        fwd_col = f"spy_fwd_{label}"
        composite_col = f"spy_composite_{label}"

        if fwd_col not in out.columns:
            out[composite_col] = np.nan
            continue

        # Build clean subset: drop NaN and rows where all factors are zero
        # (the first ~52-week warm-up period before z-scores are valid).
        needed = available_factors + [fwd_col]
        clean = out[needed].dropna()
        all_zero_mask = (clean[available_factors].abs().sum(axis=1) == 0.0)
        clean = clean[~all_zero_mask]
        if len(clean) < 20:
            out[composite_col] = np.nan
            continue

        X_all = clean[available_factors].values.astype(float)
        y_all = clean[fwd_col].values.astype(float)

        n_train = max(10, int(len(clean) * TRAIN_FRAC))
        X_train, y_train = X_all[:n_train], y_all[:n_train]
        X_test, y_test = X_all[n_train:], y_all[n_train:]

        beta, intercept = _ridge_fit(X_train, y_train, RIDGE_ALPHA)

        # Use errstate to silence harmless BLAS denormal-number artefacts
        # numpy 2.0 uses 'over' instead of 'overflow'
        with np.errstate(divide="ignore", over="ignore", under="ignore", invalid="ignore"):
            fitted_clean = X_all @ beta + intercept
            pred_train = X_train @ beta + intercept
            pred_test = X_test @ beta + intercept if len(X_test) > 0 else np.array([])

        # Normalise to ~[-1, 1] so it sits alongside other scores
        std = float(np.std(fitted_clean[np.isfinite(fitted_clean)]))
        fitted_clean_norm = np.tanh(fitted_clean / std if std > 0 else fitted_clean)

        # Write back to output df using the clean index
        out.loc[:, composite_col] = np.nan
        out.loc[clean.index, composite_col] = fitted_clean_norm

        stats[f"coef_{label}"] = {f: float(b) for f, b in zip(available_factors, beta)}
        stats[f"intercept_{label}"] = float(intercept)
        stats[f"r2_train_{label}"] = _r2(y_train, pred_train)
        stats[f"r2_test_{label}"] = _r2(y_test, pred_test) if len(pred_test) > 0 else float("nan")
        stats[f"ic_train_{label}"] = _spearman_ic(y_train, pred_train)
        stats[f"ic_test_{label}"] = _spearman_ic(y_test, pred_test) if len(pred_test) > 0 else float("nan")
        stats[f"n_train_{label}"] = int(n_train)
        stats[f"n_test_{label}"] = int(len(y_test))

    return out, stats
