import type { Channel } from "@/types";

interface ChannelPassiveWarningProps {
  channel: Channel;
}

// Body of the "Kanalı pasife al" confirm dialog (card + list row). Unlike deletion nothing is lost —
// the channel just disappears from every other screen until it's reactivated.
export function ChannelPassiveWarning({ channel }: ChannelPassiveWarningProps) {
  return (
    <>
      <p>
        <strong className="text-ink">&quot;{channel.name}&quot;</strong> pasife alınacak. Bununla birlikte:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Takvim, Dashboard, Kategoriler ve Konseptler&apos;de görünmeyecek</li>
        <li>Günlük otomatik istatistik yenilemesi duracak</li>
        <li>Takvim planları ve istatistik geçmişi saklanacak, silinmeyecek</li>
        <li>Plan kanal limitine sayılmaya devam edecek</li>
      </ul>
      <p className="mt-2">İstediğin zaman &quot;Pasif Kanallar&quot; ekranından tekrar aktife alabilirsin.</p>
    </>
  );
}
