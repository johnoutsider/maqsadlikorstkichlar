import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RoleName } from "@/types/db";

export async function requireRole(
  allowed: RoleName[],
  fallbackFor?: (role: RoleName | null) => string
) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, university_id, faculty_id, department_id, display_name, roles!inner(name)")
    .eq("id", authUser.id)
    .maybeSingle();

  const role = ((profile as any)?.roles?.name ?? null) as RoleName | null;
  if (!profile || !role || !allowed.includes(role)) {
    redirect(fallbackFor?.(role) ?? "/overview");
  }

  return { authUser, profile, role };
}
