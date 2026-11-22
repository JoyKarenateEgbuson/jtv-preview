import { notFound } from "next/navigation";
import { ShareGateScreen } from "@/components/ShareChrome";
import ShareFolderPage from "@/components/ShareFolderPage";
import { shareGate } from "@/lib/share";

// A subfolder reached through a folder share link.
export default async function ShareSubfolder({ params }: { params: Promise<{ token: string; folderId: string }> }) {
  const { token, folderId } = await params;
  const gate = await shareGate(token);
  if (gate.state === "missing") notFound();
  if (gate.state !== "ok") return <ShareGateScreen state={gate.state} token={token} />;
  return <ShareFolderPage token={token} link={gate.link} name={gate.name} folderId={folderId} />;
}
