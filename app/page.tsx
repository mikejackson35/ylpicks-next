import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ThisWeekClient from "@/components/ThisWeekClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return (
    <Suspense fallback={<div className="flex items-center gap-2 text-slate-400 text-sm"><div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />Loading...</div>}>
      <ThisWeekClient />
    </Suspense>
  );
}
