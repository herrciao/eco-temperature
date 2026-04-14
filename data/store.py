"""SQLite persistence for raw series."""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Optional

import pandas as pd


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(str(db_path))


def init_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS series_raw (
            series_name TEXT NOT NULL,
            obs_date TEXT NOT NULL,
            value REAL,
            source TEXT,
            PRIMARY KEY (series_name, obs_date)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
        """
    )
    conn.commit()


def upsert_series(
    conn: sqlite3.Connection,
    name: str,
    series: pd.Series,
    source: str,
) -> None:
    """Store a pandas Series with DatetimeIndex as ISO date strings."""
    s = series.dropna()
    if s.empty:
        return
    rows = [
        (name, idx.strftime("%Y-%m-%d"), float(v), source)
        for idx, v in s.items()
    ]
    conn.executemany(
        """
        INSERT INTO series_raw (series_name, obs_date, value, source)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(series_name, obs_date) DO UPDATE SET
            value = excluded.value,
            source = excluded.source
        """,
        rows,
    )
    conn.commit()


def load_series(conn: sqlite3.Connection, name: str) -> pd.Series:
    df = pd.read_sql(
        "SELECT obs_date, value FROM series_raw WHERE series_name = ? ORDER BY obs_date",
        conn,
        params=(name,),
    )
    if df.empty:
        return pd.Series(dtype=float)
    df["obs_date"] = pd.to_datetime(df["obs_date"])
    return df.set_index("obs_date")["value"].sort_index()


def list_series(conn: sqlite3.Connection) -> list[str]:
    cur = conn.execute("SELECT DISTINCT series_name FROM series_raw ORDER BY series_name")
    return [r[0] for r in cur.fetchall()]


def set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        """
        INSERT INTO meta (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (key, value),
    )
    conn.commit()


def get_meta(conn: sqlite3.Connection, key: str) -> Optional[str]:
    cur = conn.execute("SELECT value FROM meta WHERE key = ?", (key,))
    row = cur.fetchone()
    return row[0] if row else None
