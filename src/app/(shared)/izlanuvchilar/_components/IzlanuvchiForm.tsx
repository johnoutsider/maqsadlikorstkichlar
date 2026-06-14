"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { createClient } from "@/lib/supabase/client";
import type { Izlanuvchi, IzlanuvchiTuri } from "@/types/db";
import {
  STATUS_OPTIONS,
  TALIM_SHAKLI_OPTIONS,
  classifyTuri,
} from "../_lib/options";
import { invalidateIzlanuvchilarCache } from "../_lib/cache";
import {
  buildIzlanuvchiPayload,
  emptyIzlanuvchiForm,
  formFromIzlanuvchi,
  type IzlanuvchiFormState,
} from "@/lib/izlanuvchi-profile";

function fieldClassName(extra = "") {
  return `w-full rounded-xl bg-[var(--surface-container-highest)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none transition-all focus:bg-white focus:ring-2 focus:ring-[rgba(81,95,116,0.18)] dark:focus:bg-[var(--surface-container-high)] ${extra}`;
}

function SectionTitle({
  accent = "var(--primary)",
  children,
}: {
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex items-center gap-4">
      <div className="h-8 w-1.5 rounded-full" style={{ background: accent }} />
      <h2 className="font-display text-2xl font-bold text-[var(--on-surface)]">
        {children}
      </h2>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={fieldClassName()}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  allowEmpty = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allowEmpty?: boolean;
}) {
  const allOptions = value && !options.includes(value) ? [value, ...options] : options;

  return (
    <div className="space-y-1">
      <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName()}
      >
        {allowEmpty && <option value="">Tanlang</option>}
        {allOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
        {label}
      </label>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName("resize-y")}
      />
    </div>
  );
}

export function IzlanuvchiForm({
  initialTuri,
  recordId,
}: {
  initialTuri: IzlanuvchiTuri;
  recordId?: string;
}) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const { user } = useSupabaseAuth();
  const router = useRouter();
  const [form, setForm] = useState<IzlanuvchiFormState>(() =>
    emptyIzlanuvchiForm(initialTuri)
  );
  const [loading, setLoading] = useState(Boolean(recordId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!recordId) return;

    let cancelled = false;
    async function loadRecord() {
      setLoading(true);
      setError("");
      const { data, error: databaseError } = await supabase
        .from("izlanuvchilar")
        .select("*")
        .eq("id", recordId)
        .maybeSingle();

      if (cancelled) return;
      if (databaseError || !data) {
        setError(databaseError?.message ?? "Izlanuvchi topilmadi.");
      } else {
        setForm(formFromIzlanuvchi(data as Izlanuvchi));
      }
      setLoading(false);
    }

    loadRecord();
    return () => {
      cancelled = true;
    };
  }, [recordId, supabase]);

  const listPath =
    form.turi === "mustaqil"
      ? "/izlanuvchilar/mustaqil"
      : "/izlanuvchilar/doktorant";

  const progressFields = useMemo(
    () => [
      ["monitoring1", "Monitoring natijasi 1"] as const,
      ["monitoring2", "Monitoring natijasi 2"] as const,
      ["monitoring3", "Monitoring natijasi 3"] as const,
    ],
    []
  );

  function update<K extends keyof IzlanuvchiFormState>(
    key: K,
    value: IzlanuvchiFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!user?.university_id) {
      setError("Foydalanuvchiga universitet biriktirilmagan.");
      return;
    }

    const payload = buildIzlanuvchiPayload(form);
    if (!payload.full_name) {
      setError("Familiya va ismni kiriting.");
      return;
    }

    setSubmitting(true);
    const query = recordId
      ? supabase.from("izlanuvchilar").update(payload).eq("id", recordId)
      : supabase.from("izlanuvchilar").insert({
          ...payload,
          university_id: user.university_id,
        });
    const { error: databaseError } = await query;
    setSubmitting(false);

    if (databaseError) {
      setError(
        databaseError.code === "23505"
          ? "Bu PINFL yoki F.I.Sh va ixtisoslik bilan yozuv allaqachon mavjud."
          : databaseError.message
      );
      return;
    }

    invalidateIzlanuvchilarCache();
    router.push(
      payload.turi === "mustaqil"
        ? "/izlanuvchilar/mustaqil"
        : "/izlanuvchilar/doktorant"
    );
    router.refresh();
  }

  if (loading) {
    return <div className="py-16 text-center text-surface-400">Yuklanmoqda...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-2 pb-16 pt-2">
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] text-[var(--on-surface)]">
            {recordId ? "Izlanuvchini tahrirlash" : "Yangi izlanuvchi"}
          </h1>
          <p className="mt-2 text-sm font-medium text-[var(--on-surface-variant)]">
            Login yaratilmaydi. Ma&apos;lumotlar umumiy izlanuvchilar registrida
            saqlanadi.
          </p>
        </div>
        <Button variant="outline" size="md" onClick={() => router.push(listPath)}>
          Orqaga
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl bg-red-100 px-5 py-4 text-sm font-medium text-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            <section className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
              <SectionTitle>Shaxsiy ma&apos;lumotlar</SectionTitle>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field
                  label="Familiyasi"
                  value={form.lastName}
                  onChange={(value) => update("lastName", value)}
                  required
                />
                <Field
                  label="Ismi"
                  value={form.firstName}
                  onChange={(value) => update("firstName", value)}
                  required
                />
                <Field
                  label="Otasining ismi"
                  value={form.middleName}
                  onChange={(value) => update("middleName", value)}
                />
                <Field
                  label="Tug'ilgan sanasi"
                  type="date"
                  value={form.birthDate}
                  onChange={(value) => update("birthDate", value)}
                />
                <Field
                  label="Yoshi"
                  type="number"
                  value={form.age}
                  onChange={(value) => update("age", value)}
                />
                <SelectField
                  label="Jinsi"
                  value={form.gender}
                  onChange={(value) => update("gender", value)}
                  options={["Erkak", "Ayol"]}
                />
                <Field
                  label="PINFL"
                  value={form.pinfl}
                  onChange={(value) => update("pinfl", value)}
                  placeholder="14 xonali identifikator"
                />
                <Field
                  label="Telefon raqami"
                  type="tel"
                  value={form.phone}
                  onChange={(value) => update("phone", value)}
                  placeholder="+998 90 123 45 67"
                />
                <Field
                  label="Millati"
                  value={form.nationality}
                  onChange={(value) => update("nationality", value)}
                />
                <Field
                  label="Fuqaroligi"
                  value={form.citizenship}
                  onChange={(value) => update("citizenship", value)}
                />
              </div>
            </section>

            <section className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
              <SectionTitle>Ta&apos;lim ma&apos;lumotlari</SectionTitle>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <SelectField
                  label="Ta'lim bosqichi"
                  value={form.educationStage}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      educationStage: value,
                      turi: classifyTuri(value),
                    }))
                  }
                  options={[...TALIM_SHAKLI_OPTIONS]}
                />
                <Field
                  label="Ixtisoslik shifri"
                  value={form.specialtyCode}
                  onChange={(value) => update("specialtyCode", value)}
                />
                <div className="md:col-span-2">
                  <Field
                    label="Ixtisoslik nomi"
                    value={form.specialtyName}
                    onChange={(value) => update("specialtyName", value)}
                  />
                </div>
                <Field
                  label="O'qishga kirgan yil"
                  value={form.admissionYear}
                  onChange={(value) => update("admissionYear", value)}
                />
                <Field
                  label="Topshirgan vaqti"
                  type="date"
                  value={form.submissionDate}
                  onChange={(value) => update("submissionDate", value)}
                />
                <Field
                  label="Kursi"
                  value={form.course}
                  onChange={(value) => update("course", value)}
                  placeholder="1-kurs"
                />
                <Field
                  label="Ta'lim tili"
                  value={form.talimTili}
                  onChange={(value) => update("talimTili", value)}
                />
                <Field
                  label="Chorak / Davr"
                  value={form.chorak}
                  onChange={(value) => update("chorak", value)}
                />
                <SelectField
                  label="Holat"
                  value={form.status}
                  onChange={(value) => update("status", value)}
                  options={[...STATUS_OPTIONS]}
                  allowEmpty
                />
                <div className="md:col-span-2">
                  <Field
                    label="Himoya holati"
                    value={form.himoyaHolati}
                    onChange={(value) => update("himoyaHolati", value)}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
              <SectionTitle>Ilmiy faoliyat</SectionTitle>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Field
                    label="Ilmiy rahbar F.I.Sh."
                    value={form.supervisorName}
                    onChange={(value) => update("supervisorName", value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <TextAreaField
                    label="Ilmiy ish mavzusi"
                    value={form.researchTopic}
                    onChange={(value) => update("researchTopic", value)}
                  />
                </div>
                {progressFields.map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    value={form[key]}
                    onChange={(value) => update(key, value)}
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-8 lg:col-span-4">
            <section className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
              <SectionTitle accent="#16803c">Doimiy manzili</SectionTitle>
              <div className="space-y-5">
                <Field
                  label="Mamlakat"
                  value={form.country}
                  onChange={(value) => update("country", value)}
                />
                <Field
                  label="Viloyat"
                  value={form.region}
                  onChange={(value) => update("region", value)}
                />
                <Field
                  label="Tuman"
                  value={form.district}
                  onChange={(value) => update("district", value)}
                />
                <TextAreaField
                  label="Manzil"
                  value={form.address}
                  onChange={(value) => update("address", value)}
                />
              </div>
            </section>

            <section
              className="relative overflow-hidden rounded-3xl p-7 text-white shadow-[0_30px_70px_rgba(31,50,82,0.22)]"
              style={{ background: "linear-gradient(135deg, #6d28d9 0%, #3b1b73 100%)" }}
            >
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/15 blur-3xl" />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-white/65">
                  Registry turi
                </p>
                <h3 className="mt-3 font-display text-xl font-bold">
                  {form.turi === "mustaqil"
                    ? "Mustaqil izlanuvchi"
                    : "Doktorant / stajor-tadqiqotchi"}
                </h3>
                <p className="mt-4 text-sm leading-6 text-white/75">
                  Ro&apos;yxat ta&apos;lim bosqichiga qarab avtomatik aniqlanadi.
                  PINFL mavjud bo&apos;lsa, qayta import shu yozuvni yangilaydi.
                </p>
              </div>
            </section>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => router.push(listPath)}
          >
            Bekor qilish
          </Button>
          <Button type="submit" size="md" isLoading={submitting}>
            {recordId ? "O'zgarishlarni saqlash" : "Izlanuvchini yaratish"}
          </Button>
        </div>
      </form>
    </div>
  );
}
