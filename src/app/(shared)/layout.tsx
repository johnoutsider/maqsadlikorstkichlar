import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireRole } from "@/lib/server/require-role";
import type { RoleName } from "@/types/db";

const ALLOWED: RoleName[] = ["super_admin","university_admin","vice_rector","science_department","dean","staff_manager","oquv_bolimi"];

export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ALLOWED);

  return <AppShell allowed={ALLOWED}>{children}</AppShell>;
}
