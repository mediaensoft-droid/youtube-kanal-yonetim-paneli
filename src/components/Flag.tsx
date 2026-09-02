import { flagImageUrl } from "@/lib/constants/countries";

interface FlagProps {
  code: string;
  className?: string;
}

// A real flag image rather than a flag emoji — Windows doesn't render regional-indicator flag
// emoji as pictures (it falls back to plain two-letter text), so emoji flags silently look broken
// there. alt="" because this always sits next to text that already names the country.
export function Flag({ code, className }: FlagProps) {
  if (code.length !== 2) return null;
  return <img src={flagImageUrl(code)} alt="" loading="lazy" className={className} />;
}
