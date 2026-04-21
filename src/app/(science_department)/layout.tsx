"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import type { RoleName } from "@/types/db";

const ALLOWED: RoleName[] = ["science_department"];

export default function ScienceDepartmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      allowed={ALLOWED}
      fallbackFor={(role) => (role === "super_admin" ? "/universities" : "/overview")}
    >
      {children}
    </AppShell>
  );
}
