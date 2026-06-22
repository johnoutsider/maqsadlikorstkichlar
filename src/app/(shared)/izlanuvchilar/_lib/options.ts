import type { IzlanuvchiTuri } from "@/types/db";

export const TALIM_SHAKLI_OPTIONS = [
  "Tayanch doktorantura, PhD",
  "Doktorantura, DSc",
  "Mustaqil tadqiqotchi, PhD",
  "Mustaqil tadqiqotchi, DSc",
  "Stajor-tadqiqotchi",
] as const;

export const STATUS_OPTIONS = [
  "Talabgor o'qishga qabul qilingan",
  "O'qishni davom ettirmoqda",
  "Akademik ta'tilda",
  "Doktorant o'qishni tugatgan",
  "Doktorant chetlashtirilgan",
  "Himoya qilgan",
] as const;

export const GENDER_OPTIONS = ["Erkak", "Ayol"] as const;

export function norm(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/\s+/g, " ");
}

export function labelToSlug<T extends string>(
  map: Record<T, string>,
  value: string
): T | null {
  const normalized = norm(value);
  for (const [key, label] of Object.entries(map) as [T, string][]) {
    if (norm(key) === normalized || norm(label) === normalized) return key;
  }
  return null;
}

export function classifyTuri(educationStage: string): IzlanuvchiTuri {
  return norm(educationStage).includes("mustaqil") ? "mustaqil" : "doktorant";
}

export function normalizeGender(value: string): "erkak" | "ayol" | null {
  const normalized = norm(value);
  if (["erkak", "male", "мужской", "мужчина"].includes(normalized)) return "erkak";
  if (["ayol", "female", "женский", "женщина"].includes(normalized)) return "ayol";
  return null;
}

export function genderLabel(value: string | null) {
  if (value === "erkak") return "Erkak";
  if (value === "ayol") return "Ayol";
  return "";
}

export function statusBadgeClass(status: string | null) {
  const normalized = norm(status ?? "");
  if (
    normalized.includes("chetlasht") ||
    normalized.includes("rad") ||
    normalized.includes("bekor")
  ) {
    return "bg-red-100 text-red-700 dark:bg-red-900/35 dark:text-red-300";
  }
  if (
    normalized.includes("qabul") ||
    normalized.includes("davom") ||
    normalized.includes("tugat") ||
    normalized.includes("himoya")
  ) {
    return "bg-green-100 text-green-700 dark:bg-green-900/35 dark:text-green-300";
  }
  return "bg-surface-100 text-surface-700 dark:bg-surface-700 dark:text-surface-200";
}
