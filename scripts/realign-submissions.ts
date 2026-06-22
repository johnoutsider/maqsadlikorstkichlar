/**
 * One-time backfill: re-point every submission whose frozen department/faculty
 * no longer matches its submitter's CURRENT department, and physically move the
 * stored files into the correct department folder.
 *
 * Background: submissions are keyed by submitted_by (the user), but each row and
 * every file path froze the department at submit time. After an admin corrected
 * a "Kafedra mas'uli" account's department, those reports stayed attached to the
 * old (wrong) kafedra in reviewer/admin/stats views. This realigns them.
 *
 * Usage (from project root):
 *   npx tsx scripts/realign-submissions.ts          # DRY RUN — prints the plan
 *   npx tsx scripts/realign-submissions.ts --apply  # actually move + rewrite
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Idempotent: safe to re-run after a partial failure.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { realignUserSubmissions } from "../src/lib/realign-submissions";

// --- minimal .env.local loader (no dotenv dependency) ----------------------
function loadEnv(file: string) {
  let text: string;
  try {
    text = readFileSync(resolve(process.cwd(), file), "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

async function main() {
  loadEnv(".env.local");
  const apply = process.argv.includes("--apply");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Mode: ${apply ? "APPLY (live)" : "DRY RUN"}\n`);

  // 1. Find every submission whose snapshot diverges from its submitter's
  //    current department/faculty.
  const { data: subs, error: subErr } = await admin
    .from("submissions")
    .select("id, submitted_by, department_id, faculty_id, university_id");
  if (subErr) throw new Error(`load submissions: ${subErr.message}`);

  const submitterIds = Array.from(
    new Set((subs ?? []).map((s) => s.submitted_by).filter(Boolean)),
  ) as string[];

  const { data: users, error: userErr } = await admin
    .from("users")
    .select("id, department_id, faculty_id, university_id")
    .in("id", submitterIds);
  if (userErr) throw new Error(`load users: ${userErr.message}`);

  const userById = new Map(
    (users ?? []).map((u) => [
      u.id as string,
      u as { id: string; department_id: string | null; faculty_id: string | null; university_id: string | null },
    ]),
  );

  // Affected users = those with at least one mismatched submission, within the
  // SAME university (never move data across universities).
  const affected = new Map<string, { department_id: string; faculty_id: string | null }>();
  for (const s of subs ?? []) {
    const u = userById.get(s.submitted_by as string);
    if (!u || !u.department_id) continue;
    if (u.university_id !== s.university_id) continue;
    const mismatch = s.department_id !== u.department_id || s.faculty_id !== u.faculty_id;
    if (mismatch) {
      affected.set(u.id, { department_id: u.department_id, faculty_id: u.faculty_id });
    }
  }

  if (affected.size === 0) {
    console.log("Nothing to realign — all submissions already match their submitter's department.");
    return;
  }

  console.log(`Affected users: ${affected.size}\n`);

  let totalRows = 0;
  let totalMoved = 0;
  let totalSkipped = 0;

  for (const [userId, target] of affected) {
    const results = await realignUserSubmissions(admin, {
      userId,
      newDepartmentId: target.department_id,
      newFacultyId: target.faculty_id,
      dryRun: !apply,
    });
    for (const r of results) {
      totalRows++;
      totalMoved += r.movedFiles;
      totalSkipped += r.skippedFiles.length;
      console.log(
        `  user ${userId.slice(0, 8)} · ${r.year} ${r.quarter} (${r.status}) → dept ${target.department_id.slice(0, 8)} · ` +
          `${apply ? "moved" : "would move"} ${r.movedFiles} file(s)` +
          (r.skippedFiles.length ? ` · SKIPPED ${r.skippedFiles.length}` : ""),
      );
      for (const sk of r.skippedFiles) {
        console.warn(`      ! ${sk.reason}: ${sk.path}`);
      }
    }
  }

  console.log(
    `\n${apply ? "Done" : "Dry run complete"}: ${totalRows} row(s), ${totalMoved} file(s) ${apply ? "moved" : "to move"}` +
      (totalSkipped ? `, ${totalSkipped} skipped (see warnings)` : "") +
      ".",
  );
  if (!apply) console.log("Re-run with --apply to perform the changes.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
