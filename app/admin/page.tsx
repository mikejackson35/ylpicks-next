import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AdminClient from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!session.user.isAdmin) redirect("/");
  return <AdminClient />;
}
