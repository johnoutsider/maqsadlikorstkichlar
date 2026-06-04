import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireRole } from "@/lib/server/require-role";
import type { RoleName } from "@/types/db";

const ALLOWED: RoleName[] = ["supervisor"];

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ALLOWED, (role) => (role === "super_admin" ? "/universities" : "/overview"));

  return (
    <AppShell allowed={ALLOWED}>
      {children}
    </AppShell>
  );
}
