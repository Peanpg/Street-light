import SurveyApp from "./survey-app";
import { getTeamUser } from "@/lib/team-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ point?: string }> }) {
  const params = await searchParams;
  const user = await getTeamUser();
  if (!user) redirect("/login?returnTo=" + encodeURIComponent(params.point ? "/?point=" + encodeURIComponent(params.point) : "/"));
  return <SurveyApp signedIn />;
}
