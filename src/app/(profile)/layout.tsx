import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireRole } from "@/lib/server/require-role";
import { ALL_ROLES } from "@/lib/role-labels";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ALL_ROLES);

  return <AppShell allowed={ALL_ROLES}>{children}</AppShell>;
}
