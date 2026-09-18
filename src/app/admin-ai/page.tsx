import { requireOwner } from "@/lib/auth/server";
import { AdminWorkspace } from "./workspace";
import "./support.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "AI Admin · Gold Mine",
  robots: { index: false, follow: false },
};
export default async function AdminPage() {
  await requireOwner();
  return <AdminWorkspace />;
}
