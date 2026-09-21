import ReportApp from "./report-app";
import { getTeamUser } from "@/lib/team-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  if (!await getTeamUser()) redirect("/login?returnTo=%2Freport");
  return <ReportApp />;
}
