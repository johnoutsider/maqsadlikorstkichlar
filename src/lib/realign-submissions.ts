import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Realign a user's submission rows + stored files to their CURRENT department.
//
// Submissions are keyed by `submitted_by` (the user), but each row freezes a
// snapshot of department_id / faculty_id taken at submit time, and every file
// path embeds the department id at segment index 3:
//   {university_id}/{year}/{quarter}/{department_id}/{indicator_id}/{file}
//
// When an admin later corrects the user's department, those snapshots and file
// paths still point at the OLD (wrong) department, so reviewer / admin / stats
// views — which read department_id/faculty_id off the row — show the report
// under the wrong kafedra (or not at all under the correct one).
//
// This helper re-points the row AND physically moves the files into the
// correct department folder, then rewrites the path strings inside `indicators`
// so everything is self-consistent again. It is idempotent: a file already at
// its destination (or a row already aligned) is skipped, so it is safe to
// re-run after a partial failure.
//
// Used by both the one-time backfill script and the admin user-edit API so a
// future department change never strands data again.
// ---------------------------------------------------------------------------

const BUCKET = "submissions";
const DEPT_SEGMENT = 3; // index of {department_id} in the storage path

type IndicatorCell = { value: number | null; files?: string[] };
type IndicatorMap = Record<string, IndicatorCell>;

export interface RealignResult {
  submissionId: string;
  year: number;
  quarter: string;
  status: string;
  rekeyed: boolean;
  movedFiles: number;
  skippedFiles: { path: string; reason: string }[];
}

// Swap the department segment of a stored file path. Returns null if the path
// doesn't look like a submission path (so we leave unknown strings untouched).
function rewriteDeptInPath(path: string, newDepartmentId: string): string | null {
  const parts = path.split("/");
  if (parts.length < DEPT_SEGMENT + 2) return null;
  if (parts[DEPT_SEGMENT] === newDepartmentId) return path; // already correct
  parts[DEPT_SEGMENT] = newDepartmentId;
  return parts.join("/");
}

// Does an object exist at this path? createSignedUrl errors for a missing key,
// which lets us detect "already moved" without listing folders.
async function objectExists(admin: SupabaseClient, path: string): Promise<boolean> {
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 30);
  return !error && !!data;
}

export interface RealignOptions {
  userId: string;
  newDepartmentId: string;
  newFacultyId: string | null;
  /** Only realign rows in these statuses. Omit to realign all of the user's rows. */
  statuses?: string[];
  /** Don't touch storage or rows; just report what would change. */
  dryRun?: boolean;
}

export async function realignUserSubmissions(
  admin: SupabaseClient,
  opts: RealignOptions,
): Promise<RealignResult[]> {
  const { userId, newDepartmentId, newFacultyId, statuses, dryRun } = opts;

  let query = admin
    .from("submissions")
    .select("id, year, quarter, status, department_id, faculty_id, indicators")
    .eq("submitted_by", userId);
  if (statuses && statuses.length > 0) query = query.in("status", statuses);

  const { data: subs, error } = await query;
  if (error) throw new Error(`load submissions for ${userId}: ${error.message}`);

  const results: RealignResult[] = [];

  for (const sub of (subs ?? []) as Array<{
    id: string;
    year: number;
    quarter: string;
    status: string;
    department_id: string | null;
    faculty_id: string | null;
    indicators: IndicatorMap | null;
  }>) {
    const needsRekey =
      sub.department_id !== newDepartmentId || sub.faculty_id !== newFacultyId;

    const indicators: IndicatorMap = sub.indicators ?? {};
    const nextIndicators: IndicatorMap = {};
    const skippedFiles: { path: string; reason: string }[] = [];
    let movedFiles = 0;
    let anyPathChanged = false;

    for (const [indId, cell] of Object.entries(indicators)) {
      const files = Array.isArray(cell?.files) ? cell.files : [];
      const newFiles: string[] = [];

      for (const oldPath of files) {
        const newPath = rewriteDeptInPath(oldPath, newDepartmentId);
        if (!newPath || newPath === oldPath) {
          newFiles.push(oldPath); // unrecognized or already-correct path
          continue;
        }

        if (dryRun) {
          newFiles.push(newPath);
          anyPathChanged = true;
          movedFiles++;
          continue;
        }

        const { error: moveErr } = await admin.storage.from(BUCKET).move(oldPath, newPath);
        if (moveErr) {
          // Idempotency: source already moved (gone) but destination present.
          if (await objectExists(admin, newPath)) {
            newFiles.push(newPath);
            anyPathChanged = true;
            continue;
          }
          // Couldn't move and destination isn't there — keep the old reference
          // so the file stays openable, and report it.
          skippedFiles.push({ path: oldPath, reason: moveErr.message });
          newFiles.push(oldPath);
          continue;
        }

        movedFiles++;
        anyPathChanged = true;
        newFiles.push(newPath);
      }

      nextIndicators[indId] = { ...cell, files: newFiles };
    }

    if (!needsRekey && !anyPathChanged) continue; // nothing to do for this row

    if (!dryRun) {
      const update: Record<string, unknown> = {
        department_id: newDepartmentId,
        faculty_id: newFacultyId,
      };
      if (anyPathChanged) update.indicators = nextIndicators;
      const { error: upErr } = await admin
        .from("submissions")
        .update(update)
        .eq("id", sub.id);
      if (upErr) throw new Error(`update submission ${sub.id}: ${upErr.message}`);
    }

    results.push({
      submissionId: sub.id,
      year: sub.year,
      quarter: sub.quarter,
      status: sub.status,
      rekeyed: needsRekey,
      movedFiles,
      skippedFiles,
    });
  }

  return results;
}
