"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import type { RoleName } from "@/types/db";

const ALLOWED: RoleName[] = ["super_admin"];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell allowed={ALLOWED} fallbackFor={() => "/overview"}>
      {children}
    </AppShell>
  );
}
