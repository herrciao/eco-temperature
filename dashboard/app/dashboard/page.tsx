import { redirect } from "next/navigation";

/** 許多人會開成 /dashboard；本專案首頁在 / */
export default function DashboardAliasPage() {
  redirect("/");
}
