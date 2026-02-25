import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ResultsClient from "@/components/ResultsClient";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <ResultsClient />;
}
