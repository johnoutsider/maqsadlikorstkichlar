"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type {
  MonitoringEvaluationDeviceKind,
  MonitoringEvaluationLogField,
} from "@/types/db";

export type EvaluationChangeInput = {
  criterion_key: string;
  indicator_label: string;
  field: MonitoringEvaluationLogField;
  old_value: string | null;
  new_value: string | null;
};

function clientIp(forwardedFor: string | null, realIp: string | null) {
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return realIp?.trim() || null;
}

export async function logEvaluationChanges(
  evaluationId: string,
  deviceKind: MonitoringEvaluationDeviceKind,
  changes: EvaluationChangeInput[]
) {
  if (changes.length === 0) return { error: null };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("users")
    .select("university_id, display_name")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.university_id) return { error: "User profile not found" };

  const requestHeaders = await headers();
  const ipAddress = clientIp(
    requestHeaders.get("x-forwarded-for"),
    requestHeaders.get("x-real-ip")
  );

  const rows = changes.map((change) => ({
    evaluation_id: evaluationId,
    university_id: profile.university_id,
    changed_by: auth.user.id,
    changed_by_name: profile.display_name,
    device_kind: deviceKind,
    ip_address: ipAddress,
    criterion_key: change.criterion_key,
    indicator_label: change.indicator_label,
    field: change.field,
    old_value: change.old_value,
    new_value: change.new_value,
  }));

  const { error } = await supabase
    .from("monitoring_evaluation_logs")
    .insert(rows);

  return { error: error?.message ?? null };
}
