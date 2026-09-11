import type { Channel } from "@/types";

interface ChannelDeleteWarningProps {
  channel: Channel;
}

// Shared body of the "Kanalı sil" confirm dialog (card + list row). Spells out everything the
// server-side cascade removes along with the channel so the user isn't surprised afterwards.
export function ChannelDeleteWarning({ channel }: ChannelDeleteWarningProps) {
  return (
    <>
      <p>
        <strong className="text-ink">&quot;{channel.name}&quot;</strong> kalıcı olarak silinecek. Bununla
        birlikte:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Takvimdeki tüm planları ve yayın kayıtları silinecek</li>
        <li>Aylık yayın günleri ve abone/görüntülenme geçmişi silinecek</li>
        <li>Dashboard, Kategoriler ve Konseptler sayfalarından kaldırılacak</li>
      </ul>
      <p className="mt-2">Bu işlem geri alınamaz.</p>
    </>
  );
}
