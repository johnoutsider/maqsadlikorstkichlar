"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

interface ReportAttachment {
  path: string;
  url: string;
}

interface ReportRow {
  id: string;
  period_start: string;
  period_end: string;
  description: string;
  supervisor_feedback: string | null;
  attachments: ReportAttachment[];
}

async function resolveAttachments(
  supabase: ReturnType<typeof createClient>,
  filePaths: string[] | null | undefined
) {
  if (!filePaths?.length) return [];

  const resolved = await Promise.all(
    filePaths.map(async (path) => {
      if (/^https?:\/\//i.test(path)) {
        return { path, url: path };
      }

      const { data } = await supabase.storage
        .from("progress-reports")
        .createSignedUrl(path, 60 * 60);

      return { path, url: data?.signedUrl ?? "" };
    })
  );

  return resolved.filter((item) => !!item.url);
}

export default function SupervisorReportsPage() {
  const supabase = createClient();
  const params = useParams<{ id: string }>();
  const { user } = useSupabaseAuth();
  const [studentName, setStudentName] = useState("");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!user) return;

      setLoading(true);
      setError("");

      const { data: supervisor } = await supabase
        .from("supervisors")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!supervisor) {
        setError("Supervisor profili topilmadi.");
        setLoading(false);
        return;
      }

      const { data: doktorant } = await supabase
        .from("doktorantlar")
        .select("id, full_name")
        .eq("id", params.id)
        .eq("supervisor_id", supervisor.id)
        .maybeSingle();

      if (!doktorant) {
        setError("Bu doktorant sizga biriktirilmagan.");
        setLoading(false);
        return;
      }

      setStudentName(doktorant.full_name);

      const { data: rawReports } = await supabase
        .from("progress_reports")
        .select("id, period_start, period_end, description, supervisor_feedback, file_urls")
        .eq("doktorant_id", doktorant.id)
        .order("created_at", { ascending: false });

      const hydrated = await Promise.all(
        ((rawReports as any[]) ?? []).map(async (report) => ({
          id: report.id,
          period_start: report.period_start,
          period_end: report.period_end,
          description: report.description,
          supervisor_feedback: report.supervisor_feedback,
          attachments: await resolveAttachments(supabase, report.file_urls),
        }))
      );

      setReports(hydrated);
      setFeedbackDrafts(
        hydrated.reduce<Record<string, string>>((acc, report) => {
          acc[report.id] = report.supervisor_feedback ?? "";
          return acc;
        }, {})
      );
      setLoading(false);
    }

    load();
  }, [params.id, supabase, user]);

  const saveFeedback = async (reportId: string) => {
    setSavingId(reportId);
    setError("");

    const { error: updateError } = await supabase
      .from("progress_reports")
      .update({
        supervisor_feedback: feedbackDrafts[reportId]?.trim() || null,
        feedback_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    if (updateError) {
      setError(updateError.message);
      setSavingId(null);
      return;
    }

    setReports((current) =>
      current.map((report) =>
        report.id === reportId
          ? { ...report, supervisor_feedback: feedbackDrafts[reportId]?.trim() || null }
          : report
      )
    );
    setSavingId(null);
  };

  if (loading) return <div className="p-10 text-center">Yuklanmoqda...</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-(--on-surface)">Doktorant hisobotlari</h1>
          <p className="mt-1 text-sm text-(--on-surface-variant)">{studentName}</p>
        </div>
        <Link href="/doktorantura/mening-talabalarim">
          <Button variant="outline">Orqaga</Button>
        </Link>
      </div>

      {error && <div className="rounded-lg bg-red-100 p-4 text-red-800">{error}</div>}

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-(--outline-variant) bg-(--surface-container-lowest) py-8 text-center text-(--on-surface-variant)">
          Hozircha hisobotlar mavjud emas.
        </div>
      ) : (
        <div className="space-y-5">
          {reports.map((report) => (
            <div key={report.id} className="space-y-4 rounded-2xl border border-(--outline-variant) bg-(--surface-container-lowest) p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-(--on-surface)">{report.period_start} - {report.period_end}</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-(--on-surface)">{report.description}</p>
                </div>
              </div>

              {report.attachments.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-(--on-surface-variant)">Fayllar</p>
                  <div className="flex flex-wrap gap-2">
                    {report.attachments.map((file, index) => (
                      <a
                        key={file.path}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-(--outline-variant) bg-(--surface-container) px-3 py-1.5 text-xs text-(--on-surface) transition-colors hover:bg-(--surface-container-high)"
                      >
                        Fayl {index + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-(--on-surface-variant)">Rahbar fikri</label>
                <textarea
                  className="min-h-[120px] w-full rounded-lg border border-(--outline) bg-(--surface) p-3 outline-none"
                  value={feedbackDrafts[report.id] ?? ""}
                  onChange={(e) =>
                    setFeedbackDrafts((current) => ({
                      ...current,
                      [report.id]: e.target.value,
                    }))
                  }
                  placeholder="Doktorant hisobotiga izoh va tavsiyalar yozing..."
                />
              </div>

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  isLoading={savingId === report.id}
                  onClick={() => saveFeedback(report.id)}
                >
                  Fikrni saqlash
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
