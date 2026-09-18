import { requireOwner } from "@/lib/auth/server";
import { MarketingWorkspace } from "./workspace";
import "./marketing.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Marketing Workspace · Gold Mine",
  robots: { index: false, follow: false },
};
export default async function MarketingPage() {
  await requireOwner();
  return <MarketingWorkspace />;
}
