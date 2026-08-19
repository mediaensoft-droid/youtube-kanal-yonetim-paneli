// Colorblind-safe categorical palette (Okabe-Ito), used for category color presets
// and as a fallback for chart series colors.
export const CATEGORICAL_PALETTE: string[] = [
  "#E69F00", // orange
  "#56B4E9", // sky blue
  "#009E73", // bluish green
  "#F0E442", // yellow
  "#0072B2", // blue
  "#D55E00", // vermillion
  "#CC79A7", // reddish purple
  "#999999", // grey
];

export function paletteColor(index: number): string {
  return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length];
}

function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

// WCAG relative luminance → pick black or white text for readable contrast.
export function contrastTextColor(hexColor: string): "#000000" | "#ffffff" {
  if (!isValidHex(hexColor)) return "#000000";
  const r = parseInt(hexColor.slice(1, 3), 16) / 255;
  const g = parseInt(hexColor.slice(3, 5), 16) / 255;
  const b = parseInt(hexColor.slice(5, 7), 16) / 255;
  const linear = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.5 ? "#000000" : "#ffffff";
}
