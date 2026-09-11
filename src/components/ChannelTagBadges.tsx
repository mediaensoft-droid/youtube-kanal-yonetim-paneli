import type { Category, Concept } from "@/types";
import { CategoryBadge } from "@/components/CategoryBadge";

interface ChannelTagBadgesProps {
  categories: Category[];
  concepts: Concept[];
  /** Shown when the channel has no category at all ("Kategorisiz", "—", …). */
  emptyLabel?: string;
}

// Every category and concept a channel carries, in one badge row. Categories come first so the
// (usually fewer) concepts read as a suffix; a channel with neither shows the empty label once.
export function ChannelTagBadges({ categories, concepts, emptyLabel = "Kategorisiz" }: ChannelTagBadgesProps) {
  if (categories.length === 0 && concepts.length === 0) {
    return <span className="text-xs text-ink-faint">{emptyLabel}</span>;
  }
  return (
    <>
      {categories.map((c) => (
        <CategoryBadge key={`cat-${c.id}`} name={c.name} color={c.color} />
      ))}
      {concepts.map((c) => (
        <CategoryBadge key={`con-${c.id}`} name={c.name} color={c.color} />
      ))}
    </>
  );
}
