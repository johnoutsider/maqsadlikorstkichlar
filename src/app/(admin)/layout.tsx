"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import type { RoleName } from "@/types/db";

const ALLOWED: RoleName[] = ["university_admin", "vice_rector", "science_department", "dean"];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      allowed={ALLOWED}
      fallbackFor={(role) => (role === "super_admin" ? "/universities" : role === "staff_manager" ? "/form" : "/login")}
    >
      {children}
    </AppShell>
  );
}
