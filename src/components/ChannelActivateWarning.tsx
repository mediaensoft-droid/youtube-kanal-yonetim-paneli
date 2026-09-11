import type { Channel } from "@/types";

interface ChannelActivateWarningProps {
  channel: Channel;
}

// Body of the "Kanalı aktif yap" confirm dialog for planned (reference) channels: the channel moves
// into the user's own set, so it starts showing up everywhere and counts toward the plan limit.
export function ChannelActivateWarning({ channel }: ChannelActivateWarningProps) {
  return (
    <>
      <p>
        <strong className="text-ink">&quot;{channel.name}&quot;</strong> aktif kanallarına taşınacak. Bununla
        birlikte:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Takvim, Dashboard, Kategoriler ve Konseptler&apos;de görünmeye başlar</li>
        <li>Planlanan kanal listesinden çıkar, kendi kanal limitine sayılır</li>
        <li>Verileri, kategori/konsept ve notları aynen korunur</li>
      </ul>
    </>
  );
}
