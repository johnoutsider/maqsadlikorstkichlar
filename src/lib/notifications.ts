import type { SupabaseClient } from "@supabase/supabase-js";

type NotifyInput = {
  university_id: string | null;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
};

export async function createNotifications(
  supabase: SupabaseClient,
  rows: NotifyInput[]
): Promise<void> {
  if (rows.length === 0) return;
  await supabase.from("notifications").insert(
    rows.map((r) => ({
      university_id: r.university_id,
      recipient_id: r.recipient_id,
      type: r.type,
      title: r.title,
      message: r.message,
      data: r.data ?? {},
    }))
  );
}

// Notify the dean(s) of a specific faculty. The staff-submit step calls this
// first — the dean is the first approver in the new workflow.
export async function notifyDeans(
  supabase: SupabaseClient,
  args: {
    universityId: string;
    facultyId: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  const { data: deans } = await supabase
    .from("users")
    .select("id, roles!inner(name)")
    .eq("university_id", args.universityId)
    .eq("faculty_id", args.facultyId)
    .eq("roles.name", "dean");
  const list = (deans ?? []) as Array<{ id: string }>;
  await createNotifications(
    supabase,
    list.map((r) => ({
      university_id: args.universityId,
      recipient_id: r.id,
      type: "submission_pending_dean",
      title: args.title,
      message: args.message,
      data: args.data,
    }))
  );
}

// Notify the science department — called after the dean advances a submission.
export async function notifyScienceDepartment(
  supabase: SupabaseClient,
  args: {
    universityId: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  const { data: reviewers } = await supabase
    .from("users")
    .select("id, roles!inner(name)")
    .eq("university_id", args.universityId)
    .in("roles.name", ["science_department"]);
  const list = (reviewers ?? []) as Array<{ id: string }>;
  await createNotifications(
    supabase,
    list.map((r) => ({
      university_id: args.universityId,
      recipient_id: r.id,
      type: "submission_pending_science",
      title: args.title,
      message: args.message,
      data: args.data,
    }))
  );
}

// Legacy — kept so any old callers still resolve; now just an alias of the
// science-department notifier.
export async function notifyReviewers(
  supabase: SupabaseClient,
  args: {
    universityId: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  return notifyScienceDepartment(supabase, args);
}
