import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import BlogClient from "@/components/BlogClient";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <BlogClient />;
}
