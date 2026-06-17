import type { AgeGroup } from "@/types/tournament";
import { normalizeAgeGroup } from "@/lib/ageCategories";

export const WEIGHT_CATEGORIES = [
  "-40kg",
  "-45kg",
  "-50kg",
  "-55kg",
  "-60kg",
  "-65kg",
  "-70kg",
  "-75kg",
  "-80kg",
  "-85kg",
  "-90kg",
];

export const BASE_ROUNDS = 2;
export const TIEBREAKER_ROUNDS = 3;

export function normalizeWeightCategory(value?: string | null) {
  if (!value) return "";
  return value.trim().replace(/^\+/, "-");
}

export function getNextWeightCategory(category: string) {
  const normalized = normalizeWeightCategory(category);
  const index = WEIGHT_CATEGORIES.indexOf(normalized);
  if (index >= 0 && index + 1 < WEIGHT_CATEGORIES.length) return WEIGHT_CATEGORIES[index + 1];
  return normalized;
}

export function isUnder14AgeGroup(ageGroup?: string | null) {
  const normalized = normalizeAgeGroup(ageGroup);
  return normalized === "Mini" || normalized === "Cadet";
}

export function baseRoundsForAgeGroup(ageGroup?: AgeGroup | string | null) {
  void ageGroup;
  return BASE_ROUNDS;
}
