import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireRole } from "@/lib/server/require-role";
import type { RoleName } from "@/types/db";

const ALLOWED: RoleName[] = ["university_admin", "vice_rector", "science_department", "dean"];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ALLOWED, (role) =>
    role === "super_admin" ? "/universities" : role === "staff_manager" ? "/form" : "/login"
  );

  return (
    <AppShell allowed={ALLOWED}>
      {children}
    </AppShell>
  );
}
