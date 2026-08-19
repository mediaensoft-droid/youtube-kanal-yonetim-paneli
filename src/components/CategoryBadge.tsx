import { contrastTextColor } from "@/lib/colors";

interface CategoryBadgeProps {
  name: string;
  color: string;
}

export function CategoryBadge({ name, color }: CategoryBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: color, color: contrastTextColor(color) }}
    >
      {name}
    </span>
  );
}
