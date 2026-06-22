import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireRole } from "@/lib/server/require-role";
import type { RoleName } from "@/types/db";

const ALLOWED: RoleName[] = ["monitor"];

export default async function MonitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(ALLOWED);

  return <AppShell allowed={ALLOWED}>{children}</AppShell>;
}
