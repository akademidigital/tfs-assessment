// Pure scoring helpers. No database access, no hardcoded item counts.

export const SCALE_MIN = 1;
export const SCALE_MAX = 5;

export const SCALE_OPTIONS = [
  { value: 1, label: "Sangat Tidak Sesuai" },
  { value: 2, label: "Tidak Sesuai" },
  { value: 3, label: "Netral" },
  { value: 4, label: "Sesuai" },
  { value: 5, label: "Sangat Sesuai" },
] as const;

export function scoreAnswer(direction: "F" | "UF", answerValue: number): number {
  return direction === "F" ? answerValue : SCALE_MIN + SCALE_MAX - answerValue;
}

export function normalize(raw: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  const min = itemCount * SCALE_MIN;
  const max = itemCount * SCALE_MAX;
  if (max === min) return 0;
  return Math.round(((raw - min) / (max - min)) * 1000) / 10;
}

export type Band = {
  category: string;
  min_score: number;
  max_score: number;
  interpretation: string;
  sequence: number;
};

/**
 * Band tables are authored against the blueprint's nominal item counts, which
 * can differ slightly from the live registry. We therefore rescale the raw
 * score into the band table's own span before matching, so categories stay
 * correct no matter how many items a module actually has.
 */
export function matchBandByRaw(bands: Band[], raw: number, itemCount: number): Band | null {
  if (bands.length === 0) return null;
  const sorted = [...bands].sort((a, b) => a.min_score - b.min_score);
  const low = sorted[0]!.min_score;
  const high = sorted[sorted.length - 1]!.max_score;
  const possibleMin = itemCount * SCALE_MIN;
  const possibleMax = itemCount * SCALE_MAX;
  const fraction =
    possibleMax === possibleMin ? 0 : (raw - possibleMin) / (possibleMax - possibleMin);
  const scaled = low + fraction * (high - low);
  return (
    sorted.find((b) => scaled >= b.min_score && scaled <= b.max_score) ?? sorted[sorted.length - 1]!
  );
}

export function matchBandByScore(bands: Band[], score: number): Band | null {
  if (bands.length === 0) return null;
  const sorted = [...bands].sort((a, b) => a.min_score - b.min_score);
  return (
    sorted.find((b) => score >= b.min_score && score <= b.max_score) ?? sorted[sorted.length - 1]!
  );
}

export function dimensionStatus(normalized: number): string {
  if (normalized < 50) return "Perlu Penguatan";
  if (normalized < 75) return "Berkembang";
  return "Kuat";
}
