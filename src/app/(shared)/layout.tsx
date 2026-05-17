"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import type { RoleName } from "@/types/db";

const ALLOWED: RoleName[] = ["super_admin","university_admin","vice_rector","science_department","dean","staff_manager","oquv_bolimi"];

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell allowed={ALLOWED}>{children}</AppShell>;
}
