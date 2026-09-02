import clsx from "clsx";

interface CardGlowProps {
  variant?: "default" | "reverse" | "slow" | "subtle";
}

// A slow rotating color wash behind a Dashboard card's content — decorative only. The parent
// card needs `relative overflow-hidden`, and the real content needs its own `relative z-10`
// wrapper so it paints above this.
export function CardGlow({ variant = "default" }: CardGlowProps) {
  return (
    <div
      className={clsx(
        "card-glow",
        variant === "reverse" && "card-glow--reverse",
        variant === "slow" && "card-glow--slow",
        variant === "subtle" && "card-glow--subtle"
      )}
      aria-hidden="true"
    />
  );
}
