import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import StatsClient from "@/components/StatsClient";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <StatsClient />;
}
