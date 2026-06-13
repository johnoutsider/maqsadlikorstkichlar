// Status labels and small helpers for the dissertation defense-application
// workflow: applicant -> science_department -> vice_rector -> department.

import type { DefenseStatus } from "@/types/db";

export const DEFENSE_STATUS_LABEL: Record<DefenseStatus, { text: string; cls: string }> = {
  draft:                { text: "Qoralama",                          cls: "bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-200" },
  pending_science:      { text: "Ilmiy bo'lim tekshiruvida",         cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  pending_vice_rector:  { text: "Ilmiy prorektor tasdiqlashi kutilmoqda", cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  needs_revision:       { text: "Qayta ko'rib chiqish kerak",        cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  approved:             { text: "Tasdiqlangan",                      cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  rejected:             { text: "Rad etilgan",                       cls: "bg-danger-100 text-danger-800 dark:bg-danger-900/40 dark:text-danger-300" },
};

export function canReviewDefenseApplication(role: string, status: DefenseStatus): boolean {
  if (status === "pending_science") return role === "science_department";
  if (status === "pending_vice_rector") return role === "vice_rector";
  return false;
}

export function generateReferenceCode(id: string, year: number): string {
  const suffix = id.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `HIM-${year}-${suffix}`;
}
