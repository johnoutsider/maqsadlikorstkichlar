"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { cacheInvalidate } from "@/lib/curriculum-cache";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Faculty, Department } from "@/types/db";
import type { TeacherFormState } from "../_lib/options";
import {
  ILMIY_DARAJA_LABEL,
  ILMIY_UNVON_LABEL,
  ISH_TURI_LABEL,
  FAOLIYAT_LABEL,
  STAVKA_OPTIONS,
  LAVOZIM_OPTIONS,
  EMPTY_FORM,
} from "../_lib/options";
import type { IlmiyDaraja, IlmiyUnvon, IshTuri, FaoliyatHolati } from "@/types/db";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

type Errors = Partial<Record<keyof TeacherFormState, string>>;

const NAME_RE   = /^[A-Za-zА-Яа-яЁёҚқҒғҲҳӢӣҮүҚқ\s'-]{2,}$/;
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE  = /^(\+998|998|0)[0-9]{9}$/;

function validate(form: TeacherFormState, isStaffManager: boolean): Errors {
  const e: Errors = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Names
  if (!form.last_name.trim()) {
    e.last_name = "Familiya kiritilishi shart.";
  } else if (!NAME_RE.test(form.last_name.trim())) {
    e.last_name = "Faqat harflar, bo'shliq yoki tire kiritish mumkin (min 2 belgi).";
  }

  if (!form.first_name.trim()) {
    e.first_name = "Ism kiritilishi shart.";
  } else if (!NAME_RE.test(form.first_name.trim())) {
    e.first_name = "Faqat harflar, bo'shliq yoki tire kiritish mumkin (min 2 belgi).";
  }

  if (!form.middle_name.trim()) {
    e.middle_name = "Otasining ismi kiritilishi shart.";
  } else if (!NAME_RE.test(form.middle_name.trim())) {
    e.middle_name = "Faqat harflar, bo'shliq yoki tire kiritish mumkin (min 2 belgi).";
  }

  // Birth date
  if (!form.birth_date) {
    e.birth_date = "Tug'ilgan sana kiritilishi shart.";
  } else {
    const bd = new Date(form.birth_date);
    const age = Math.floor((today.getTime() - bd.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (bd >= today) {
      e.birth_date = "Tug'ilgan sana o'tgan sana bo'lishi kerak.";
    } else if (age < 18) {
      e.birth_date = "O'qituvchi yoshi kamida 18 bo'lishi kerak.";
    } else if (age > 80) {
      e.birth_date = "O'qituvchi yoshi 80 dan oshmasligi kerak.";
    }
  }

  // Gender
  if (!form.gender) {
    e.gender = "Jinsi tanlanishi shart.";
  }

  // Phone
  if (!form.phone.trim()) {
    e.phone = "Telefon raqami kiritilishi shart.";
  } else {
    const digits = form.phone.replace(/[\s\-()]/g, "");
    if (!PHONE_RE.test(digits)) {
      e.phone = "Format: +998 XX XXX XX XX";
    }
  }

  // Email
  if (!form.email.trim()) {
    e.email = "Email kiritilishi shart.";
  } else if (!EMAIL_RE.test(form.email.trim())) {
    e.email = "Noto'g'ri email format.";
  }

  // Department (faculty handled by cascade)
  if (!isStaffManager && !form.faculty_id) {
    e.faculty_id = "Fakultet tanlanishi shart.";
  }
  if (!form.department_id) {
    e.department_id = "Kafedra tanlanishi shart.";
  }

  // Academic
  if (!form.ilmiy_daraja) {
    e.ilmiy_daraja = "Ilmiy daraja tanlanishi shart.";
  }
  if (!form.ilmiy_unvon) {
    e.ilmiy_unvon = "Ilmiy unvon tanlanishi shart.";
  }
  if (!form.lavozim) {
    e.lavozim = "Lavozim tanlanishi shart.";
  }

  // Employment
  if (!form.stavka) {
    e.stavka = "Ish stavkasi tanlanishi shart.";
  }
  if (!form.ish_turi) {
    e.ish_turi = "Ish turi tanlanishi shart.";
  }
  if (!form.ishga_kirgan_sana) {
    e.ishga_kirgan_sana = "Ishga kirgan sana kiritilishi shart.";
  } else {
    const hd = new Date(form.ishga_kirgan_sana);
    if (hd >= today) {
      e.ishga_kirgan_sana = "Ishga kirgan sana o'tgan sana bo'lishi kerak.";
    } else if (form.birth_date && hd <= new Date(form.birth_date)) {
      e.ishga_kirgan_sana = "Ishga kirgan sana tug'ilgan sanadan keyin bo'lishi kerak.";
    }
  }

  return e;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 mt-1 text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
      {children}
    </h3>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-200 bg-white p-6 dark:border-surface-700 dark:bg-surface-800">
      {children}
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs" style={{ color: "#ba1a1a" }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" />
      </svg>
      {msg}
    </p>
  );
}

// Standalone select — used directly (not via Field) when we need the error border
function Sel({
  value, onChange, required, error, children,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  const hasError = !!error;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={[
        "w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition-colors",
        "focus:outline-none focus:ring-2",
        hasError
          ? "border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-red-200 dark:border-red-500 dark:bg-red-900/10"
          : "border-surface-300 bg-white focus:border-primary-500 focus:ring-primary-500/20 dark:border-surface-600 dark:bg-surface-800",
        "text-surface-900 dark:text-surface-100",
      ].join(" ")}
    >
      {children}
    </select>
  );
}

function LabeledSel({
  label,
  value,
  onChange,
  error,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
        {label}<span className="ml-0.5 text-danger-500">*</span>
      </label>
      <Sel value={value} onChange={onChange} required error={error}>
        {children}
      </Sel>
      <FieldError msg={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  mode: "create" | "edit";
  teacherId?: string;
  initialValues?: Partial<TeacherFormState>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeacherForm({ mode, teacherId, initialValues }: Props) {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const router = useRouter();

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState<TeacherFormState>({ ...EMPTY_FORM, ...initialValues });
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  const isStaffManager = user?.role === "staff_manager";

  // Load faculty/dept lists
  useEffect(() => {
    (async () => {
      const [tf, td] = await Promise.all([
        supabase.from("faculties").select("*").order("name"),
        supabase.from("departments").select("*").order("name"),
      ]);
      setFaculties((tf.data as Faculty[]) ?? []);
      setDepartments((td.data as Department[]) ?? []);
    })();
  }, [supabase]);

  // Prefill locked dept/faculty for staff_manager once departments load
  useEffect(() => {
    if (!isStaffManager || departments.length === 0) return;
    const myDept = departments.find((d) => d.id === user?.department_id);
    if (myDept && !form.department_id) {
      setForm((prev) => ({
        ...prev,
        faculty_id:    myDept.faculty_id,
        department_id: myDept.id,
      }));
    }
  }, [isStaffManager, departments, user?.department_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const myDept    = useMemo(() => departments.find((d) => d.id === user?.department_id) ?? null, [departments, user?.department_id]);
  const myFaculty = useMemo(() => myDept ? faculties.find((f) => f.id === myDept.faculty_id) ?? null : null, [faculties, myDept]);
  const formDepts = useMemo(() => departments.filter((d) => d.faculty_id === form.faculty_id), [departments, form.faculty_id]);

  // Re-validate on every change after first submit attempt
  function set(key: keyof TeacherFormState, value: string) {
    const next = { ...form, [key]: value };
    setForm(next);
    if (submitted) {
      const nextErrors = validate(next, isStaffManager);
      setErrors(nextErrors);
    }
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setServerError("");

    const errs = validate(form, isStaffManager);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      // Scroll to first error
      setTimeout(() => {
        document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }

    const payload = {
      university_id:     user?.university_id,
      faculty_id:        form.faculty_id        || null,
      department_id:     form.department_id     || null,
      last_name:         form.last_name.trim(),
      first_name:        form.first_name.trim(),
      middle_name:       form.middle_name.trim()    || null,
      birth_date:        form.birth_date             || null,
      gender:            form.gender                 || null,
      phone:             form.phone.replace(/[\s\-()]/g, ""),
      email:             form.email.trim(),
      ilmiy_daraja:      form.ilmiy_daraja            || null,
      ilmiy_unvon:       form.ilmiy_unvon             || null,
      lavozim:           form.lavozim.trim()          || null,
      stavka:            form.stavka                  || null,
      ish_turi:          form.ish_turi                || null,
      ishga_kirgan_sana: form.ishga_kirgan_sana       || null,
      faoliyat_holati:   form.faoliyat_holati || "faol",
    };

    setSaving(true);
    let dbErr;
    if (mode === "edit" && teacherId) {
      ({ error: dbErr } = await supabase.from("teachers").update(payload).eq("id", teacherId));
    } else {
      ({ error: dbErr } = await supabase.from("teachers").insert({ ...payload, created_by: user?.id }));
    }
    setSaving(false);

    if (dbErr) { setServerError(dbErr.message); return; }
    if (user?.university_id) cacheInvalidate(user.university_id);
    router.push("/teachers");
  }

  const errCount = Object.keys(errors).length;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Server error */}
      {serverError && (
        <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-700 dark:bg-danger-900/30 dark:text-danger-400">
          {serverError}
        </div>
      )}

      {/* Summary banner shown after first failed submit */}
      {submitted && errCount > 0 && (
        <div
          data-field-error
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
          </svg>
          <span>{errCount} ta maydon to&apos;ldirilmagan yoki noto&apos;g&apos;ri kiritilgan. Iltimos, tekshiring.</span>
        </div>
      )}

      {/* ── Shaxsiy ma'lumotlar ─────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Shaxsiy ma&apos;lumotlar</SectionTitle>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Familiya *"
            value={form.last_name}
            onChange={(e) => set("last_name", e.target.value)}
            error={errors.last_name}
            placeholder="Karimov"
            autoComplete="off"
          />
          <Input
            label="Ism *"
            value={form.first_name}
            onChange={(e) => set("first_name", e.target.value)}
            error={errors.first_name}
            placeholder="Alisher"
            autoComplete="off"
          />
          <Input
            label="Otasining ismi *"
            value={form.middle_name}
            onChange={(e) => set("middle_name", e.target.value)}
            error={errors.middle_name}
            placeholder="Bahodirovich"
            autoComplete="off"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Tug'ilgan sana *"
            type="date"
            value={form.birth_date}
            onChange={(e) => set("birth_date", e.target.value)}
            error={errors.birth_date}
            max={new Date().toISOString().split("T")[0]}
          />
          <LabeledSel
            label="Jinsi"
            value={form.gender}
            onChange={(v) => set("gender", v)}
            error={errors.gender}
          >
            <option value="">— tanlang —</option>
            <option value="erkak">Erkak</option>
            <option value="ayol">Ayol</option>
          </LabeledSel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Telefon raqami *"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            error={errors.phone}
            placeholder="+998 90 123 45 67"
            hint="Format: +998 XX XXX XX XX"
          />
          <Input
            label="Email *"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            error={errors.email}
            placeholder="a.karimov@university.uz"
          />
        </div>
      </Card>

      {/* ── Ish joyi ────────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Ish joyi</SectionTitle>

        {isStaffManager ? (
          <div className="flex items-center gap-3 rounded-lg bg-surface-50 px-4 py-3 text-sm dark:bg-surface-900/50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-surface-400">
              <path d="M4 21V8a2 2 0 012-2h12a2 2 0 012 2v13M8 10h8M8 14h8M8 18h4" />
            </svg>
            <div>
              <span className="font-medium text-surface-800 dark:text-surface-200">{myDept?.name ?? "—"}</span>
              <span className="mx-1.5 text-surface-300">/</span>
              <span className="text-surface-500">{myFaculty?.name ?? "—"}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <LabeledSel
              label="Fakultet"
              value={form.faculty_id}
              onChange={(v) => { set("faculty_id", v); set("department_id", ""); }}
              error={errors.faculty_id}
            >
              <option value="">— tanlang —</option>
              {faculties.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </LabeledSel>

            <LabeledSel
              label="Kafedra"
              value={form.department_id}
              onChange={(v) => set("department_id", v)}
              error={errors.department_id}
            >
              <option value="">— tanlang —</option>
              {formDepts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </LabeledSel>
          </div>
        )}
      </Card>

      {/* ── Ilmiy ma'lumotlar ───────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Ilmiy ma&apos;lumotlar va lavozim</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <LabeledSel
            label="Ilmiy darajasi"
            value={form.ilmiy_daraja}
            onChange={(v) => set("ilmiy_daraja", v)}
            error={errors.ilmiy_daraja}
          >
            <option value="">— tanlang —</option>
            {(Object.entries(ILMIY_DARAJA_LABEL) as [IlmiyDaraja, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </LabeledSel>

          <LabeledSel
            label="Ilmiy unvoni"
            value={form.ilmiy_unvon}
            onChange={(v) => set("ilmiy_unvon", v)}
            error={errors.ilmiy_unvon}
          >
            <option value="">— tanlang —</option>
            {(Object.entries(ILMIY_UNVON_LABEL) as [IlmiyUnvon, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </LabeledSel>

          <LabeledSel
            label="Lavozimi"
            value={form.lavozim}
            onChange={(v) => set("lavozim", v)}
            error={errors.lavozim}
          >
            <option value="">— tanlang —</option>
            {LAVOZIM_OPTIONS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </LabeledSel>
        </div>
      </Card>

      {/* ── Mehnat shartlari ────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Mehnat shartlari</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LabeledSel
            label="Ish stavkasi"
            value={form.stavka}
            onChange={(v) => set("stavka", v)}
            error={errors.stavka}
          >
            <option value="">— tanlang —</option>
            {STAVKA_OPTIONS.map((s) => (
              <option key={s} value={s}>{s} stavka</option>
            ))}
          </LabeledSel>

          <LabeledSel
            label="Asosiy / O'rindosh"
            value={form.ish_turi}
            onChange={(v) => set("ish_turi", v)}
            error={errors.ish_turi}
          >
            <option value="">— tanlang —</option>
            {(Object.entries(ISH_TURI_LABEL) as [IshTuri, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </LabeledSel>

          <Input
            label="Ishga kirgan sanasi *"
            type="date"
            value={form.ishga_kirgan_sana}
            onChange={(e) => set("ishga_kirgan_sana", e.target.value)}
            error={errors.ishga_kirgan_sana}
            max={new Date().toISOString().split("T")[0]}
          />

          <LabeledSel
            label="Faoliyat holati"
            value={form.faoliyat_holati}
            onChange={(v) => set("faoliyat_holati", v)}
          >
            {(Object.entries(FAOLIYAT_LABEL) as [FaoliyatHolati, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </LabeledSel>
        </div>
      </Card>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1">
        <Button type="button" variant="outline" onClick={() => router.push("/teachers")}>
          ← Bekor qilish
        </Button>
        <Button type="submit" isLoading={saving}>
          {mode === "edit" ? "O'zgarishlarni saqlash" : "O'qituvchi qo'shish"}
        </Button>
      </div>
    </form>
  );
}
