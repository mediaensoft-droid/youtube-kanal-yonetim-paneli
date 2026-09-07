interface CardAuraProps {
  seed?: number;
}

// Kept very low: these sit *behind* card text, so anything stronger starts competing with it.
const RED = "rgba(255, 70, 70, 0.11)";
const TEAL = "rgba(45, 212, 191, 0.09)";

// Deterministic pseudo-random (no Math.random) so server- and client-rendered output match —
// same technique as BackgroundDecor's icon scatter.
function seeded(seed: number): number {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return Math.abs(v - Math.floor(v));
}

// Two large, edgeless radial washes that breathe very slowly behind a card's content. This
// replaces the earlier CardShapes (hard-outlined circles/rings/diamonds drifting and rotating),
// which read as busy behind text. Here nothing has a visible edge and nothing rotates, so the
// card gains depth without the eye ever being pulled to a moving object.
//
// The parent card needs `relative overflow-hidden`, and the real content needs its own
// `relative z-10` wrapper so it paints above this.
export function CardAura({ seed = 0 }: CardAuraProps) {
  const auras = [
    { color: RED, left: -14, top: -38, size: 60 },
    { color: TEAL, left: 62, top: 30, size: 48 },
  ].map((base, i) => {
    const s = seed * 97 + i * 41;
    return {
      color: base.color,
      left: base.left + (seeded(s + 1) - 0.5) * 22,
      top: base.top + (seeded(s + 2) - 0.5) * 28,
      size: base.size + (seeded(s + 3) - 0.5) * 14,
      duration: 26 + seeded(s + 4) * 14,
      // Negative delay: every card starts mid-cycle, so they never pulse in lockstep on load.
      delay: -seeded(s + 5) * 20,
      driftX: (seeded(s + 6) - 0.5) * 16,
      driftY: (seeded(s + 7) - 0.5) * 16,
    };
  });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {auras.map((aura, i) => (
        <span
          key={i}
          className="card-aura"
          style={
            {
              left: `${aura.left}%`,
              top: `${aura.top}%`,
              // Capped so the wash stays a highlight on very wide cards instead of flooding them.
              width: `min(${aura.size}%, 380px)`,
              background: `radial-gradient(circle at 50% 50%, ${aura.color} 0%, transparent 70%)`,
              animationDuration: `${aura.duration}s`,
              animationDelay: `${aura.delay}s`,
              "--aura-x": `${aura.driftX}px`,
              "--aura-y": `${aura.driftY}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
