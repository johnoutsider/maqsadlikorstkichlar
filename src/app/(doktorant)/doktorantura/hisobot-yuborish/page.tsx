"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  PROGRESS_REPORT_FILE_RULE,
  acceptAttribute,
  safeStorageFileName,
  validateFile,
} from "@/lib/upload-validation";

interface ReportAttachment {
  path: string;
  url: string;
}

interface ReportRow {
  id: string;
  created_at: string;
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

      return {
        path,
        url: data?.signedUrl ?? "",
      };
    })
  );

  return resolved.filter((file) => !!file.url);
}

export default function HisobotYuborishPage() {
  const [doktorantId, setDoktorantId] = useState<string>("");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  const [formData, setFormData] = useState({
    period_start: "",
    period_end: "",
    description: "",
  });
  const [files, setFiles] = useState<FileList | null>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  async function fetchData() {
    if (!user) return;
    setLoading(true);

    const { data: doc } = await supabase
      .from("doktorantlar")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!doc) {
      setDoktorantId("");
      setReports([]);
      setLoading(false);
      return;
    }

    setDoktorantId(doc.id);

    const { data: reps } = await supabase
      .from("progress_reports")
      .select("*")
      .eq("doktorant_id", doc.id)
      .order("created_at", { ascending: false });

    const hydrated = await Promise.all(
      ((reps as any[]) ?? []).map(async (report) => ({
        id: report.id,
        created_at: report.created_at,
        period_start: report.period_start,
        period_end: report.period_end,
        description: report.description,
        supervisor_feedback: report.supervisor_feedback,
        attachments: await resolveAttachments(supabase, report.file_urls),
      }))
    );

    setReports(hydrated);
    setLoading(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doktorantId) return;
    setSubmitting(true);
    setError("");

    try {
      const filePaths: string[] = [];
      const reportId = crypto.randomUUID();

      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const validationError = validateFile(file, PROGRESS_REPORT_FILE_RULE);
          if (validationError) throw new Error(validationError);
          const fileName = `${Date.now()}_${i}_${safeStorageFileName(file.name)}`;
          const filePath = `${doktorantId}/${reportId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("progress-reports")
            .upload(filePath, file);

          if (uploadError) throw uploadError;
          filePaths.push(filePath);
        }
      }

      const { error: insertErr } = await supabase
        .from("progress_reports")
        .insert({
          id: reportId,
          doktorant_id: doktorantId,
          period_start: formData.period_start,
          period_end: formData.period_end,
          description: formData.description,
          file_urls: filePaths,
        });

      if (insertErr) throw insertErr;

      setFormData({ period_start: "", period_end: "", description: "" });
      setFiles(null);

      const fileInput = document.getElementById("files") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";

      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Yuklanmoqda...</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-(--on-surface)">Hisobot Yuborish</h1>
        <p className="mt-1 text-sm text-(--on-surface-variant)">Davriy ilmiy hisobotlar va fayllarni yuklash</p>
      </div>

      <div className="rounded-2xl border border-(--outline-variant) bg-(--surface-container-lowest) p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-(--on-surface)">Yangi Hisobot</h2>
        {error && <div className="mb-4 rounded-lg bg-red-100 p-4 text-red-800">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Davr boshi"
              type="date"
              required
              value={formData.period_start}
              onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
            />
            <Input
              label="Davr oxiri"
              type="date"
              required
              value={formData.period_end}
              onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-(--on-surface-variant)">Bajarilgan ishlar tavsifi</label>
            <textarea
              required
              className="min-h-[120px] w-full rounded-lg border border-(--outline) bg-(--surface) p-3 outline-none"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ushbu davrda amalga oshirilgan ishlar haqida qisqacha ma'lumot qoldiring..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-(--on-surface-variant)">Fayllar (PDF, Word, Docx)</label>
            <input
              id="files"
              type="file"
              accept={acceptAttribute(PROGRESS_REPORT_FILE_RULE)}
              multiple
              className="w-full rounded-lg border border-(--outline) bg-(--surface) p-2 outline-none"
              onChange={(e) => setFiles(e.target.files)}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" isLoading={submitting}>
              Hisobotni Yuborish
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold font-display text-(--on-surface)">Yuborilgan Hisobotlar Tarixi</h2>

        {reports.length === 0 ? (
          <div className="rounded-2xl border border-(--outline-variant) bg-(--surface-container-lowest) py-8 text-center text-(--on-surface-variant)">
            Siz hali hisobot yubormagansiz.
          </div>
        ) : (
          reports.map((r) => (
            <div key={r.id} className="space-y-3 rounded-2xl border border-(--outline-variant) bg-(--surface-container-lowest) p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="font-semibold text-(--on-surface)">{r.period_start} - {r.period_end}</span>
                <span className="text-xs text-(--on-surface-variant)">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>

              <p className="whitespace-pre-wrap text-sm text-(--on-surface)">{r.description}</p>

              {r.attachments.length > 0 && (
                <div className="pt-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-(--on-surface-variant)">Ilova qilingan fayllar:</p>
                  <div className="flex flex-wrap gap-2">
                    {r.attachments.map((file, i) => (
                      <a
                        key={file.path}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-(--outline-variant) bg-(--surface-container) px-3 py-1.5 text-xs text-(--on-surface) transition-colors hover:bg-(--surface-container-high)"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                        </svg>
                        Fayl {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {r.supervisor_feedback && (
                <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300">Rahbar fikri:</p>
                  <p className="text-sm text-blue-900 dark:text-blue-200">{r.supervisor_feedback}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
