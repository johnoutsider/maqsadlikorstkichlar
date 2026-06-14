import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireRole } from "@/lib/server/require-role";
import type { RoleName } from "@/types/db";

const ALLOWED: RoleName[] = ["science_department"];

export default async function ScienceDepartmentLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ALLOWED);

  return (
    <AppShell allowed={ALLOWED}>
      {children}
    </AppShell>
  );
}
