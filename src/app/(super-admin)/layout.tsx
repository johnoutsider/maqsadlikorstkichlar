import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireRole } from "@/lib/server/require-role";
import type { RoleName } from "@/types/db";

const ALLOWED: RoleName[] = ["super_admin"];

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ALLOWED, () => "/overview");

  return (
    <AppShell allowed={ALLOWED}>
      {children}
    </AppShell>
  );
}
