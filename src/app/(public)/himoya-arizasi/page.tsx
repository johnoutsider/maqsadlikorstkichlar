"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  DISSERTATION_FIELDS,
  AVTOREFERAT_FIELDS,
  DEFENSE_DOCUMENTS,
  defenseDocumentRule,
} from "@/lib/defense-config";
import { acceptAttribute } from "@/lib/upload-validation";

const STORAGE_KEY = "himoya-arizasi-id";

type StatusResponse = {
  id: string;
  reference_code: string;
  status: string;
  phone_verified: boolean;
  applicant_full_name: string | null;
  applicant_phone: string | null;
  dissertation_info: Record<string, string>;
  avtoreferat_info: Record<string, string>;
  documents: Record<string, string[]>;
  status_label: { text: string; cls: string };
  science_comment: string | null;
  vice_rector_comment: string | null;
};

function fieldClassName(extra = "") {
  return `w-full rounded-lg outline-none transition-all ${extra}`;
}

const inputStyle: React.CSSProperties = {
  background: "var(--surface-container-highest)",
  border: "none",
  padding: "0.625rem 0.875rem",
  fontSize: "0.875rem",
  color: "var(--on-surface)",
  fontFamily: "'Public Sans', sans-serif",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="h-7 w-1.5 rounded-full" style={{ background: "var(--primary)" }} />
      <h2 className="font-display text-lg font-bold text-[var(--on-surface)]">{children}</h2>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: (typeof DISSERTATION_FIELDS)[number];
  value: string;
  onChange: (value: string) => void;
}) {
  const label = `${field.label}${field.required ? " *" : ""}`;

  if (field.type === "textarea") {
    return (
      <div className="space-y-1 sm:col-span-2">
        <label className="block mb-1.5 text-[0.8125rem] font-medium text-[var(--on-surface-variant)]">{label}</label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={field.placeholder}
          className={fieldClassName("resize-none")}
          style={inputStyle}
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-1">
        <label className="block mb-1.5 text-[0.8125rem] font-medium text-[var(--on-surface-variant)]">{label}</label>
        <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClassName()} style={inputStyle}>
          <option value="">Tanlang...</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <Input
      label={label}
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
    />
  );
}

export default function HimoyaArizasiPage() {
  const [step, setStep] = useState<"start" | "verify" | "form" | "done">("start");
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [dissertationInfo, setDissertationInfo] = useState<Record<string, string>>({});
  const [avtoreferatInfo, setAvtoreferatInfo] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function loadStatus(id: string) {
    const res = await fetch(`/api/defense-applications/${id}/status`);
    if (!res.ok) {
      localStorage.removeItem(STORAGE_KEY);
      setApplicationId(null);
      setStep("start");
      setLoading(false);
      return;
    }
    const data: StatusResponse = await res.json();
    setStatus(data);
    setDissertationInfo(data.dissertation_info ?? {});
    setAvtoreferatInfo(data.avtoreferat_info ?? {});
    setFullName(data.applicant_full_name ?? "");

    if (["pending_science", "pending_vice_rector", "approved", "rejected"].includes(data.status)) {
      setStep("done");
    } else if (data.phone_verified) {
      setStep("form");
    } else {
      setStep("verify");
    }
    setLoading(false);
  }

  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (storedId) {
      setApplicationId(storedId);
      loadStatus(storedId);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== "verify" || !applicationId) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(() => loadStatus(applicationId), 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, applicationId]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/defense-applications/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi.");
        return;
      }
      localStorage.setItem(STORAGE_KEY, data.id);
      setApplicationId(data.id);
      setStatus((prev) => ({ ...(prev as StatusResponse), id: data.id, reference_code: data.reference_code, phone_verified: false } as StatusResponse));
      setStep("verify");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpload(docKey: string, file: File) {
    if (!applicationId) return;
    setError("");
    setUploading(docKey);
    try {
      const formData = new FormData();
      formData.append("doc_key", docKey);
      formData.append("file", file);
      const res = await fetch(`/api/defense-applications/${applicationId}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Faylni yuklashda xatolik.");
        return;
      }
      setStatus((prev) => (prev ? { ...prev, documents: data.documents } : prev));
    } finally {
      setUploading(null);
    }
  }

  async function handleSubmit() {
    if (!applicationId) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/defense-applications/${applicationId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicant_full_name: fullName,
          dissertation_info: dissertationInfo,
          avtoreferat_info: avtoreferatInfo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi.");
        return;
      }
      await loadStatus(applicationId);
    } finally {
      setSubmitting(false);
    }
  }

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const deepLink = botUsername && applicationId ? `https://t.me/${botUsername}?start=${applicationId}` : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface)" }}>
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--outline-variant)", borderTopColor: "#002046" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 py-10" style={{ background: "var(--surface)" }}>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-[var(--on-surface)]">
            Dissertatsiya himoyasi uchun ariza
          </h1>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            Himoyaga tavsiya etilish uchun zarur ma&apos;lumotlar va hujjatlarni shu sahifada topshiring.
          </p>
          {status?.reference_code && (
            <p className="mt-2 text-sm font-semibold text-[var(--primary)]">
              Ariza raqami: {status.reference_code}
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: "#ffdad6" }}>
            <p className="text-sm font-medium" style={{ color: "#410002" }}>{error}</p>
          </div>
        )}

        {step === "start" && (
          <div className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
            <SectionTitle>Arizachi ma&apos;lumotlari</SectionTitle>
            <form onSubmit={handleStart} className="space-y-4">
              <Input
                label="F.I.Sh. *"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Familiya Ism Sharif"
              />
              <Input
                label="Telefon raqami *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="+998 90 123 45 67"
              />
              <Button type="submit" variant="primary" size="md" isLoading={submitting} className="w-full">
                Davom etish
              </Button>
            </form>
          </div>
        )}

        {step === "verify" && (
          <div className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
            <SectionTitle>Telefon raqamini Telegram orqali tasdiqlash</SectionTitle>
            <p className="text-sm text-[var(--on-surface-variant)]">
              Davom etish uchun Telegram botimizga o&apos;ting va &quot;Telefon raqamni ulashish&quot; tugmasini bosing.
              Tasdiqlangach, bu sahifa avtomatik ravishda davom etadi.
            </p>
            <div className="mt-4 flex flex-col items-center gap-3">
              {deepLink ? (
                <a href={deepLink} target="_blank" rel="noreferrer">
                  <Button variant="primary" size="md">Telegram botni ochish</Button>
                </a>
              ) : (
                <p className="text-sm text-[var(--on-surface-variant)]">Telegram bot hozircha sozlanmagan.</p>
              )}
              <div className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
                <div
                  className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: "var(--outline-variant)", borderTopColor: "#002046" }}
                />
                Tasdiqlanishi kutilmoqda...
              </div>
            </div>
          </div>
        )}

        {step === "form" && status && (
          <>
            <div className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
              <SectionTitle>Dissertatsiya haqida ma&apos;lumot</SectionTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {DISSERTATION_FIELDS.map((field) => (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={dissertationInfo[field.key] ?? ""}
                    onChange={(value) => setDissertationInfo((prev) => ({ ...prev, [field.key]: value }))}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
              <SectionTitle>Avtoreferat haqida ma&apos;lumot</SectionTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {AVTOREFERAT_FIELDS.map((field) => (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={avtoreferatInfo[field.key] ?? ""}
                    onChange={(value) => setAvtoreferatInfo((prev) => ({ ...prev, [field.key]: value }))}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
              <SectionTitle>Hujjatlar</SectionTitle>
              <div className="space-y-4">
                {DEFENSE_DOCUMENTS.map((doc) => {
                  const rule = defenseDocumentRule(doc);
                  const files = status.documents?.[doc.key] ?? [];
                  return (
                    <div key={doc.key} className="rounded-2xl bg-[var(--surface-container-highest)] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--on-surface)]">
                            {doc.label}{doc.required ? " *" : ""}
                          </p>
                          <p className="text-xs text-[var(--on-surface-variant)]">
                            Ruxsat etilgan: {rule.label}, max {(doc.maxBytes / (1024 * 1024)).toFixed(0)} MB
                          </p>
                        </div>
                        <div>
                          <input
                            ref={(el) => {
                              fileInputRefs.current[doc.key] = el;
                            }}
                            type="file"
                            accept={acceptAttribute(rule)}
                            className="hidden"
                            disabled={uploading === doc.key}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(doc.key, file);
                              e.target.value = "";
                            }}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            isLoading={uploading === doc.key}
                            onClick={() => fileInputRefs.current[doc.key]?.click()}
                          >
                            Fayl yuklash
                          </Button>
                        </div>
                      </div>
                      {files.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs text-[var(--on-surface-variant)]">
                          {files.map((path) => (
                            <li key={path}>{path.split("/").pop()?.replace(/^\d+_/, "")}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" size="lg" isLoading={submitting} onClick={handleSubmit}>
                Arizani yuborish
              </Button>
            </div>
          </>
        )}

        {step === "done" && status && (
          <div className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8 text-center">
            <SectionTitle>Ariza holati</SectionTitle>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${status.status_label.cls}`}>
              {status.status_label.text}
            </span>
            {status.status === "needs_revision" && status.science_comment && (
              <p className="mt-4 text-sm text-[var(--on-surface-variant)]">Izoh: {status.science_comment}</p>
            )}
            {status.status === "rejected" && status.vice_rector_comment && (
              <p className="mt-4 text-sm text-[var(--on-surface-variant)]">Izoh: {status.vice_rector_comment}</p>
            )}
            <p className="mt-4 text-sm text-[var(--on-surface-variant)]">
              Ariza holati haqida Telegram bot orqali xabardor qilinasiz.
            </p>
            {status.status === "needs_revision" && (
              <Button className="mt-4" variant="primary" size="md" onClick={() => setStep("form")}>
                Arizani tahrirlash
              </Button>
            )}
          </div>
        )}

        <p className="text-center text-xs text-[var(--on-surface-variant)] opacity-70">
          <Link href="/login">Tizimga kirish</Link>
        </p>
      </div>
    </div>
  );
}
