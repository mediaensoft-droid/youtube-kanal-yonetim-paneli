import clsx from "clsx";

interface CardShapesProps {
  seed?: number;
  count?: number;
}

const KINDS = ["circle", "ring", "dot", "diamond"] as const;
type Kind = (typeof KINDS)[number];

const RED = "rgba(220, 38, 38, 0.45)";
const TEAL = "rgba(45, 212, 191, 0.4)";

// Deterministic pseudo-random (no Math.random) so server- and client-rendered output match —
// same technique as BackgroundDecor's icon scatter.
function seeded(seed: number): number {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return Math.abs(v - Math.floor(v));
}

// A handful of small outline shapes (circle/ring/dot/diamond) that drift and rotate gently
// behind a Dashboard card's content — an alternative to a plain color gradient wash. Each card
// passes a different `seed` so the layouts don't all repeat identically. The parent card needs
// `relative overflow-hidden`, and the real content needs its own `relative z-10` wrapper so it
// paints above this.
export function CardShapes({ seed = 0, count = 5 }: CardShapesProps) {
  const shapes = Array.from({ length: count }, (_, i) => {
    const s = seed * 97 + i * 13;
    const kind: Kind = KINDS[Math.floor(seeded(s * 3 + 1) * KINDS.length)];
    const size = 14 + seeded(s * 3 + 2) * 24;
    const left = 4 + seeded(s * 5 + 1) * 88;
    const top = 6 + seeded(s * 5 + 2) * 82;
    const color = i % 2 === 0 ? RED : TEAL;
    const duration = 7 + seeded(s * 7 + 1) * 7;
    const delay = seeded(s * 7 + 2) * 5;
    const driftX = (seeded(s * 9 + 1) - 0.5) * 50;
    const driftY = (seeded(s * 9 + 2) - 0.5) * 50;
    const rotate = (seeded(s * 9 + 3) - 0.5) * 70;
    return { kind, size, left, top, color, duration, delay, driftX, driftY, rotate };
  });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {shapes.map((shape, i) => (
        <span
          key={i}
          className={clsx("card-shape", `card-shape--${shape.kind}`)}
          style={
            {
              left: `${shape.left}%`,
              top: `${shape.top}%`,
              width: shape.size,
              height: shape.size,
              borderColor: shape.color,
              backgroundColor: shape.kind === "dot" ? shape.color : undefined,
              animationDuration: `${shape.duration}s`,
              animationDelay: `${shape.delay}s`,
              "--drift-x": `${shape.driftX}px`,
              "--drift-y": `${shape.driftY}px`,
              "--drift-r": `${shape.rotate}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
