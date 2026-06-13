"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { DISSERTATION_FIELDS, AVTOREFERAT_FIELDS, DEFENSE_DOCUMENTS } from "@/lib/defense-config";
import { DEFENSE_STATUS_LABEL, canReviewDefenseApplication } from "@/lib/defense-workflow";
import type { DefenseApplication, DefenseReviewHistoryEntry } from "@/types/db";

function fieldClassName(extra = "") {
  return `w-full rounded-xl bg-[var(--surface-container-highest)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none ${extra}`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="h-7 w-1.5 rounded-full" style={{ background: "var(--primary)" }} />
      <h2 className="font-display text-lg font-bold text-[var(--on-surface)]">{children}</h2>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
        {label}
      </label>
      <input type="text" value={value || "-"} readOnly className={fieldClassName("cursor-default")} />
    </div>
  );
}

const REVIEW_OUTCOME_LABEL: Record<DefenseReviewHistoryEntry["outcome"], string> = {
  advanced: "Yo'naltirildi",
  needs_revision: "Qayta ko'rib chiqishga yuborildi",
  approved: "Tasdiqlandi",
  rejected: "Rad etildi",
};

const REVIEW_STAGE_LABEL: Record<DefenseReviewHistoryEntry["stage"], string> = {
  science: "Ilmiy bo'lim",
  vice_rector: "Ilmiy prorektor",
};

export default function HimoyaArizasiDetailPage() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  const [application, setApplication] = useState<DefenseApplication | null>(null);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [departmentId, setDepartmentId] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data } = await supabase
        .from("defense_applications")
        .select("*")
        .eq("id", params.id)
        .maybeSingle();
      if (data) setApplication(data as DefenseApplication);

      if (user?.university_id) {
        const { data: depts } = await supabase
          .from("departments")
          .select("id, name")
          .eq("university_id", user.university_id)
          .order("name");
        if (depts) setDepartments(depts as Array<{ id: string; name: string }>);
      }
      setLoading(false);
    }
    fetchData();
  }, [supabase, params.id, user?.university_id]);

  async function refresh() {
    const { data } = await supabase
      .from("defense_applications")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (data) setApplication(data as DefenseApplication);
  }

  async function handleScienceAction(action: "advance" | "needs_revision") {
    setError("");
    if (action === "advance" && !departmentId) {
      setError("Kafedra/bo'lim tanlanishi shart.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/defense-applications/${params.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, department_id: departmentId || undefined, comment: comment || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi.");
        return;
      }
      await refresh();
      setComment("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleViceRectorAction(action: "approve" | "reject") {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/defense-applications/${params.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi.");
        return;
      }
      await refresh();
      setComment("");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-(--on-surface-variant)">Yuklanmoqda...</div>;
  }

  if (!application) {
    return <div className="p-6 text-center text-(--on-surface-variant)">Ariza topilmadi.</div>;
  }

  const canReview = user ? canReviewDefenseApplication(user.role, application.status) : false;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/himoya-arizalari" className="text-sm text-(--on-surface-variant)">
            ← Himoya arizalari
          </Link>
          <h1 className="text-2xl font-bold font-display text-(--on-surface)">{application.reference_code}</h1>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${DEFENSE_STATUS_LABEL[application.status].cls}`}>
          {DEFENSE_STATUS_LABEL[application.status].text}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: "#ffdad6" }}>
          <p className="text-sm font-medium" style={{ color: "#410002" }}>{error}</p>
        </div>
      )}

      <div className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
        <SectionTitle>Arizachi ma&apos;lumotlari</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="F.I.Sh." value={application.applicant_full_name ?? ""} />
          <Field label="Telefon raqami" value={application.applicant_phone ?? ""} />
        </div>
      </div>

      <div className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
        <SectionTitle>Dissertatsiya haqida ma&apos;lumot</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {DISSERTATION_FIELDS.map((field) => (
            <Field key={field.key} label={field.label} value={application.dissertation_info?.[field.key] ?? ""} />
          ))}
        </div>
      </div>

      <div className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
        <SectionTitle>Avtoreferat haqida ma&apos;lumot</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {AVTOREFERAT_FIELDS.map((field) => (
            <Field key={field.key} label={field.label} value={application.avtoreferat_info?.[field.key] ?? ""} />
          ))}
        </div>
      </div>

      <div className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
        <SectionTitle>Hujjatlar</SectionTitle>
        <div className="space-y-2">
          {DEFENSE_DOCUMENTS.map((doc) => {
            const files = application.documents?.[doc.key] ?? [];
            return (
              <div key={doc.key} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--surface-container-highest)] p-4">
                <p className="text-sm font-semibold text-[var(--on-surface)]">{doc.label}</p>
                {files.length > 0 ? (
                  <a
                    href={`/api/defense-applications/${application.id}/documents/${doc.key}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-(--primary)"
                  >
                    Yuklab olish ({files.length})
                  </a>
                ) : (
                  <span className="text-xs text-(--on-surface-variant)">Yuklanmagan</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {application.review_history?.length > 0 && (
        <div className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
          <SectionTitle>Ko&apos;rib chiqish tarixi</SectionTitle>
          <div className="space-y-3">
            {application.review_history.map((entry, index) => (
              <div key={index} className="rounded-2xl bg-[var(--surface-container-highest)] p-4 text-sm">
                <p className="font-semibold text-[var(--on-surface)]">
                  {REVIEW_STAGE_LABEL[entry.stage]} — {REVIEW_OUTCOME_LABEL[entry.outcome]}
                </p>
                <p className="text-xs text-(--on-surface-variant)">{new Date(entry.at).toLocaleString("uz-UZ")}</p>
                {entry.comment && <p className="mt-1 text-(--on-surface-variant)">{entry.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {canReview && user?.role === "science_department" && (
        <div className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
          <SectionTitle>Ko&apos;rib chiqish</SectionTitle>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
                Yo&apos;naltiriladigan kafedra/bo&apos;lim
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className={fieldClassName()}
              >
                <option value="">Tanlang...</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
                Izoh
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className={fieldClassName("resize-none")}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" size="md" isLoading={submitting} onClick={() => handleScienceAction("advance")}>
                Ilmiy prorektorga yo&apos;naltirish
              </Button>
              <Button variant="outline" size="md" isLoading={submitting} onClick={() => handleScienceAction("needs_revision")}>
                Qayta ko&apos;rib chiqishga yuborish
              </Button>
            </div>
          </div>
        </div>
      )}

      {canReview && user?.role === "vice_rector" && (
        <div className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
          <SectionTitle>Tasdiqlash</SectionTitle>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
                Izoh
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className={fieldClassName("resize-none")}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" size="md" isLoading={submitting} onClick={() => handleViceRectorAction("approve")}>
                Tasdiqlash
              </Button>
              <Button variant="danger" size="md" isLoading={submitting} onClick={() => handleViceRectorAction("reject")}>
                Rad etish
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
