import type { RoleName } from "@/types/db";

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  university_admin: "Universitet Admin",
  vice_rector: "Prorektor",
  science_department: "Ilmiy Bo'lim",
  dean: "Dekan",
  staff_manager: "Kafedra Mas'uli",
  oquv_bolimi: "O'quv Bo'lim",
  monitor: "Nazoratchi",
  supervisor: "Ilmiy rahbar",
  doktorant: "Doktorant",
};

export const ALL_ROLES: RoleName[] = [
  "super_admin",
  "university_admin",
  "vice_rector",
  "science_department",
  "dean",
  "staff_manager",
  "oquv_bolimi",
  "monitor",
  "supervisor",
  "doktorant",
];
