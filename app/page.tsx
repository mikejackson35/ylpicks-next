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
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <p className="text-2xl font-semibold text-slate-700">Taking a one week break for teams competition at the Zurich.</p>
      <p className="mt-3 text-lg text-slate-500">See you next week for The Cadillac.</p>
    </div>
  );
}
