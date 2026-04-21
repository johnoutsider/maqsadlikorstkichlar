"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import {
  buildDoktorantMetadata,
  buildFullName,
  doktorantStatusLabels,
  doktorantProgressByStatus,
  type DoktorantFormState,
} from "@/lib/doktorant-profile";

type DepartmentRow = {
  id: string;
  name: string;
};

type SupervisorRow = {
  id: string;
  full_name: string;
  academic_title: string | null;
  email: string | null;
  workplace: string | null;
  is_external: boolean;
  departments?: { name?: string | null } | null;
};

type AccountState = {
  email: string;
  password: string;
  studentId: string;
  enrollmentYear: string;
  departmentId: string;
  supervisorId: string;
  thesisStatus: string;
};

const defaultForm: DoktorantFormState = {
  lastName: "",
  firstName: "",
  middleName: "",
  birthDate: "",
  gender: "Erkak",
  nationality: "O'zbek",
  citizenship: "O'zbekiston Respublikasi",
  category: "Tayanch doktorantura (PhD)",
  scienceField: "Texnika fanlari",
  specialty: "",
  studyStatus: "Taklif bosqichi",
  course: "1-kurs",
  paymentType: "Davlat granti",
  department: "",
  admissionDate: `${new Date().getFullYear()}-09-01`,
  researchTopic: "",
  country: "O'zbekiston",
  region: "Toshkent shahri",
  district: "",
  address: "",
  supervisorName: "",
  supervisorTitle: "",
  supervisorDegree: "",
  supervisorOrganization: "",
  supervisorEmail: "",
  supervisorPhone: "",
  consultantName: "",
  consultantTitle: "",
  consultantDegree: "",
};

function fieldClassName(extra = "") {
  return `w-full rounded-xl bg-[var(--surface-container-highest)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none transition-all focus:bg-white focus:ring-2 focus:ring-[rgba(81,95,116,0.18)] ${extra}`;
}

function SectionTitle({ accent = "var(--primary)", children }: { accent?: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <div className="h-8 w-1.5 rounded-full" style={{ background: accent }} />
      <h2 className="font-display text-2xl font-bold text-[var(--on-surface)]">{children}</h2>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={fieldClassName(readOnly ? "cursor-default" : "")}
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
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
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={fieldClassName("resize-none")}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1">
      <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
        {label}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClassName()}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function CreateDoktorantPage() {
  const router = useRouter();
  const supabase = createClient();

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [account, setAccount] = useState<AccountState>({
    email: "",
    password: "",
    studentId: "",
    enrollmentYear: new Date().getFullYear().toString(),
    departmentId: "",
    supervisorId: "",
    thesisStatus: "taklif",
  });
  const [form, setForm] = useState<DoktorantFormState>(defaultForm);

  useEffect(() => {
    async function loadData() {
      const { data: deps } = await supabase.from("departments").select("id, name").order("name");
      if (deps) setDepartments(deps as DepartmentRow[]);

      const { data: sups } = await supabase
        .from("supervisors")
        .select("id, full_name, academic_title, email, workplace, is_external, departments(name)")
        .order("full_name");
      if (sups) setSupervisors(sups as unknown as SupervisorRow[]);
    }

    loadData();
  }, [supabase]);

  const progress = useMemo(
    () => doktorantProgressByStatus[account.thesisStatus] ?? 0,
    [account.thesisStatus]
  );

  const selectedDepartmentName = useMemo(
    () => departments.find((department) => department.id === account.departmentId)?.name ?? "",
    [departments, account.departmentId]
  );

  const selectedSupervisor = useMemo(
    () => supervisors.find((supervisor) => supervisor.id === account.supervisorId) ?? null,
    [supervisors, account.supervisorId]
  );

  useEffect(() => {
    if (!selectedDepartmentName) return;
    setForm((current) => ({ ...current, department: selectedDepartmentName }));
  }, [selectedDepartmentName]);

  useEffect(() => {
    if (!selectedSupervisor) return;
    setForm((current) => ({
      ...current,
      supervisorName: selectedSupervisor.full_name ?? "",
      supervisorTitle: selectedSupervisor.academic_title ?? "",
      supervisorOrganization: selectedSupervisor.is_external
        ? selectedSupervisor.workplace ?? ""
        : selectedSupervisor.departments?.name ?? "Universitet xodimi",
      supervisorEmail: selectedSupervisor.email ?? "",
    }));
  }, [selectedSupervisor]);

  const updateForm = <K extends keyof DoktorantFormState>(key: K, value: DoktorantFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const fullName = buildFullName(form.lastName, form.firstName, form.middleName);

      if (!fullName) {
        throw new Error("Doktorantning familiya, ismi va otasining ismini kiriting.");
      }

      const res = await fetch("/api/provision-doktorant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: account.email,
          password: account.password,
          full_name: fullName,
          student_id: account.studentId,
          enrollment_year: parseInt(account.enrollmentYear, 10),
          research_topic: form.researchTopic,
          department_id: account.departmentId,
          supervisor_id: account.supervisorId || null,
          thesis_status: account.thesisStatus,
          metadata: buildDoktorantMetadata(form),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create doktorant");
      }

      router.push("/doktorantura");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-2 pb-16 pt-2">
      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] text-[var(--on-surface)]">
            Yangi doktorant profili
          </h1>
          <p className="mt-2 text-sm font-medium text-[var(--on-surface-variant)]">
            Ilmiy bo&apos;lim doktorantning login, shaxsiy ma&apos;lumotlari, manzili va ta&apos;lim dossierini bir martada yaratadi.
          </p>
        </div>
        <Button variant="outline" size="md" onClick={() => router.back()}>
          Orqaga
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl bg-red-100 px-5 py-4 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            <section className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
              <SectionTitle>Login va identifikatsiya</SectionTitle>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Email" type="email" value={account.email} onChange={(value) => setAccount((c) => ({ ...c, email: value }))} />
                <Field label="Parol" value={account.password} onChange={(value) => setAccount((c) => ({ ...c, password: value }))} />
                <Field label="Student ID" value={account.studentId} onChange={(value) => setAccount((c) => ({ ...c, studentId: value }))} />
                <Field label="Qabul qilingan yil" type="number" value={account.enrollmentYear} onChange={(value) => setAccount((c) => ({ ...c, enrollmentYear: value }))} />
                <div>
                  <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
                    Kafedra
                  </label>
                  <select
                    value={account.departmentId}
                    onChange={(e) => setAccount((c) => ({ ...c, departmentId: e.target.value }))}
                    className={fieldClassName()}
                  >
                    <option value="">Tanlang</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
                    Ilmiy rahbar
                  </label>
                  <select
                    value={account.supervisorId}
                    onChange={(e) => setAccount((c) => ({ ...c, supervisorId: e.target.value }))}
                    className={fieldClassName()}
                  >
                    <option value="">Tanlang</option>
                    {supervisors.map((supervisor) => (
                      <option key={supervisor.id} value={supervisor.id}>
                        {supervisor.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
              <SectionTitle>Shaxsiy ma&apos;lumotlar</SectionTitle>
              <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-44 w-full max-w-[13rem] flex-col items-center justify-center rounded-3xl bg-[var(--surface-container-low)] px-4 text-center text-[var(--on-surface-variant)]">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/75 text-xl font-bold text-[var(--primary)]">
                      {form.firstName?.[0] ?? "D"}
                    </div>
                    <p className="text-sm font-semibold">Rasm keyin yuklanadi</p>
                  </div>
                  <p className="mt-3 max-w-[11rem] text-center text-xs text-[var(--on-surface-variant)]">
                    Doktorant o&apos;z profilida rasmi uchun alohida oqim qo&apos;shilishi mumkin.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5 md:col-span-2 md:grid-cols-2">
                  <Field label="Familiyasi" value={form.lastName} onChange={(value) => updateForm("lastName", value)} />
                  <Field label="Ismi" value={form.firstName} onChange={(value) => updateForm("firstName", value)} />
                  <Field label="Otasining ismi" value={form.middleName} onChange={(value) => updateForm("middleName", value)} />
                  <Field label="Tug'ilgan sanasi" type="date" value={form.birthDate} onChange={(value) => updateForm("birthDate", value)} />
                  <SelectField label="Jinsi" value={form.gender} onChange={(value) => updateForm("gender", value)} options={["Erkak", "Ayol"]} />
                  <Field label="Millati" value={form.nationality} onChange={(value) => updateForm("nationality", value)} />
                  <div className="md:col-span-2">
                    <Field label="Fuqaroligi" value={form.citizenship} onChange={(value) => updateForm("citizenship", value)} />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
              <SectionTitle>Ta&apos;lim ma&apos;lumotlari</SectionTitle>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <SelectField
                  label="Izlanuvchi toifasi"
                  value={form.category}
                  onChange={(value) => updateForm("category", value)}
                  options={["Tayanch doktorantura (PhD)", "Doktorantura (DSc)", "Mustaqil izlanuvchi"]}
                />
                <Field label="Fan sohasi" value={form.scienceField} onChange={(value) => updateForm("scienceField", value)} />
                <div className="md:col-span-2">
                  <Field label="Ixtisoslik" value={form.specialty} onChange={(value) => updateForm("specialty", value)} />
                </div>
                <SelectField
                  label="Holati"
                  value={form.studyStatus}
                  onChange={(value) => updateForm("studyStatus", value)}
                  options={Object.values(doktorantStatusLabels)}
                />
                <SelectField
                  label="Kurs"
                  value={form.course}
                  onChange={(value) => updateForm("course", value)}
                  options={["1-kurs", "2-kurs", "3-kurs", "Bitiruvchi"]}
                />
                <Field label="To'lov turi" value={form.paymentType} onChange={(value) => updateForm("paymentType", value)} />
                <Field label="Qabul qilingan sana" type="date" value={form.admissionDate} onChange={(value) => updateForm("admissionDate", value)} />
                <div className="md:col-span-2">
                  <Field label="Kafedra" value={form.department} onChange={(value) => updateForm("department", value)} readOnly />
                </div>
                <div className="md:col-span-2">
                  <TextAreaField label="Dissertatsiya mavzusi" value={form.researchTopic} onChange={(value) => updateForm("researchTopic", value)} />
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
              <SectionTitle>Ilmiy rahbar ma&apos;lumotlari</SectionTitle>
              <div className="space-y-10">
                <div>
                  <div className="mb-5 text-xs font-bold uppercase tracking-[0.05em] text-[var(--primary)]">
                    Asosiy ilmiy rahbar
                  </div>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Field label="F.I.Sh." value={form.supervisorName} onChange={(value) => updateForm("supervisorName", value)} readOnly />
                    </div>
                    <Field label="Unvoni" value={form.supervisorTitle} onChange={(value) => updateForm("supervisorTitle", value)} readOnly />
                    <Field label="Ilmiy darajasi" value={form.supervisorDegree} onChange={(value) => updateForm("supervisorDegree", value)} />
                    <div className="md:col-span-2">
                      <Field label="Tashkilot" value={form.supervisorOrganization} onChange={(value) => updateForm("supervisorOrganization", value)} readOnly />
                    </div>
                    <Field label="Email" type="email" value={form.supervisorEmail} onChange={(value) => updateForm("supervisorEmail", value)} />
                    <Field label="Telefon" value={form.supervisorPhone} onChange={(value) => updateForm("supervisorPhone", value)} />
                  </div>
                </div>

                <div className="rounded-3xl bg-[var(--surface-container-low)] p-5">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div className="text-xs font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
                      Ilmiy maslahatchi (ixtiyoriy)
                    </div>
                    <button
                      type="button"
                      className="text-xs font-bold text-[var(--primary)]"
                      onClick={() => {
                        updateForm("consultantName", "");
                        updateForm("consultantTitle", "");
                        updateForm("consultantDegree", "");
                      }}
                    >
                      Clear Fields
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Field label="F.I.Sh." value={form.consultantName} onChange={(value) => updateForm("consultantName", value)} />
                    </div>
                    <Field label="Unvoni" value={form.consultantTitle} onChange={(value) => updateForm("consultantTitle", value)} />
                    <Field label="Ilmiy darajasi" value={form.consultantDegree} onChange={(value) => updateForm("consultantDegree", value)} />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-8 lg:col-span-4">
            <section className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
              <SectionTitle accent="var(--tertiary)">Doimiy manzili</SectionTitle>
              <div className="space-y-5">
                <Field label="Mamlakat" value={form.country} onChange={(value) => updateForm("country", value)} />
                <Field label="Viloyat" value={form.region} onChange={(value) => updateForm("region", value)} />
                <Field label="Tuman" value={form.district} onChange={(value) => updateForm("district", value)} />
                <TextAreaField label="Manzil" value={form.address} onChange={(value) => updateForm("address", value)} />
              </div>
            </section>

            <section
              className="relative overflow-hidden rounded-3xl p-8 shadow-[0_30px_70px_rgba(31,50,82,0.28)]"
              style={{ background: "linear-gradient(135deg, #5c6f89 0%, #304764 100%)" }}
            >
              <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/18 blur-3xl" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))]" />
              <div className="relative z-10">
                <h3 className="font-display text-lg font-bold text-white">Boshlang&apos;ich progress</h3>
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/15 pb-4">
                    <span className="text-sm font-medium text-white/75">PhD Progress</span>
                    <span className="font-bold text-white">{progress}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.45)]" style={{ width: `${progress}%` }} />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.05em] text-white/65">
                      Progress bosqichi
                    </label>
                    <select
                      value={account.thesisStatus}
                      onChange={(e) => setAccount((c) => ({ ...c, thesisStatus: e.target.value }))}
                      className="w-full rounded-2xl bg-white/12 px-4 py-3 text-sm font-medium text-white outline-none bg-black/5 focus:ring-2 focus:ring-white/30"
                    >
                      {Object.entries(doktorantStatusLabels).map(([key, label]) => (
                        <option key={key} value={key} className="text-slate-900">
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-2xl bg-white/12 px-4 py-3 text-sm font-medium text-white">
                    {doktorantStatusLabels[account.thesisStatus] ?? account.thesisStatus}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-end gap-4">
          <Button type="button" variant="secondary" size="md" onClick={() => router.back()}>
            Bekor qilish
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={submitting}>
            Doktorantni yaratish
          </Button>
        </div>
      </form>
    </div>
  );
}
