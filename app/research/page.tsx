import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ResearchClient from "@/components/ResearchClient";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <ResearchClient />;
}
