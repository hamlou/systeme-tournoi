import type { AgeGroup } from "@/types/tournament";

export const AGE_GROUPS: AgeGroup[] = ["Mini", "Cadet", "Junior", "Senior"];

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  Mini: "Mini: 6-11 years",
  Cadet: "Cadet: 12-14 years",
  Junior: "Junior: 15-17 years",
  Senior: "Senior: 18 years and older",
};

export function normalizeAgeGroup(value?: string | null): AgeGroup {
  if (!value) return "Senior";
  const trimmed = value.trim();
  if (trimmed === "Mini" || trimmed === "Cadet" || trimmed === "Junior" || trimmed === "Senior") return trimmed;
  if (trimmed === "Senior A" || trimmed === "Senior B" || trimmed === "Senior C") return "Senior";
  if (trimmed === "U16" || trimmed === "U18") return "Junior";
  if (trimmed === "U14") return "Cadet";
  if (trimmed === "U8" || trimmed === "U10" || trimmed === "U12") return "Mini";
  return "Senior";
}

export function isYouthAgeGroup(value?: string | null) {
  const ageGroup = normalizeAgeGroup(value);
  return ageGroup === "Mini" || ageGroup === "Cadet" || ageGroup === "Junior";
}

export function totalRoundsForAgeGroup(value?: string | null) {
  normalizeAgeGroup(value);
  return 3;
}

export function getRoundDuration(
  roundDurations: Partial<Record<AgeGroup, number>> | undefined,
  ageGroup?: string | null,
) {
  const normalized = normalizeAgeGroup(ageGroup);
  return roundDurations?.[normalized] ?? (normalized === "Mini" ? 60 : normalized === "Cadet" ? 90 : normalized === "Junior" ? 120 : 180);
}

export function formatMatchCategory(ageGroup?: string | null, weightCategory?: string | null) {
  return [normalizeAgeGroup(ageGroup), weightCategory].filter(Boolean).join(" ");
}

export function parseCategoryId(categoryId: string) {
  const parts = categoryId.trim().split(/\s+/);
  const weightCategory = parts.find(part => /kg$/i.test(part)) ?? parts[parts.length - 1] ?? "";
  const ageGroup = normalizeAgeGroup(parts.filter(part => part !== weightCategory).join(" "));
  return { ageGroup, weightCategory, category: formatMatchCategory(ageGroup, weightCategory) };
}
