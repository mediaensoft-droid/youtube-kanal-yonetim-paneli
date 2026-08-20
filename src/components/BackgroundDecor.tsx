const PLAY_ICONS = [
  { left: "8%", top: "14%", delay: "0s", duration: "17s" },
  { left: "24%", top: "72%", delay: "2s", duration: "20s" },
  { left: "60%", top: "20%", delay: "1s", duration: "18s" },
  { left: "82%", top: "62%", delay: "3s", duration: "22s" },
  { left: "45%", top: "50%", delay: "1.5s", duration: "19s" },
];

export function BackgroundDecor() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="animate-drift-a absolute -top-40 -left-40 h-72 w-72 rounded-full bg-brand/[0.035] blur-[100px]" />
      <div className="animate-drift-b absolute top-1/3 -right-40 h-64 w-64 rounded-full bg-brand/[0.03] blur-[100px]" />
      <div className="animate-drift-c absolute -bottom-40 left-1/3 h-64 w-64 rounded-full bg-red-900/[0.06] blur-[100px]" />

      {PLAY_ICONS.map((icon, i) => (
        <svg
          key={i}
          className="animate-float-icon absolute h-5 w-5 text-brand/[0.05]"
          style={{ left: icon.left, top: icon.top, animationDelay: icon.delay, animationDuration: icon.duration }}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      ))}
    </div>
  );
}
