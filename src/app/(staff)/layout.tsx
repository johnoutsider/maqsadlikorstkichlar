import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireRole } from "@/lib/server/require-role";
import type { RoleName } from "@/types/db";

const ALLOWED: RoleName[] = ["staff_manager"];

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ALLOWED);

  return (
    <AppShell allowed={ALLOWED}>
      {children}
    </AppShell>
  );
}
