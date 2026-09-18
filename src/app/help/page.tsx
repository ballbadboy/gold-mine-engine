import { PlayerChat } from "./player-chat";
import "../admin-ai/support.css";
export const metadata = {
  title: "ศูนย์ช่วยเหลือผู้เล่น · Gold Mine",
  robots: { index: false, follow: false },
};
export default function HelpPage() {
  return <PlayerChat />;
}
