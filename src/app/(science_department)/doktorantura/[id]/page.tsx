"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import {
  doktorantProgressByStatus,
  doktorantStatusLabels,
  splitFullName,
  type DoktorantFormState,
  type DoktorantMetadata,
} from "@/lib/doktorant-profile";

type SupervisorRecord = {
  full_name?: string;
  academic_title?: string | null;
  email?: string | null;
  is_external?: boolean;
  workplace?: string | null;
  departments?: { name?: string | null } | null;
};

type DoktorantRecord = {
  id: string;
  auth_user_id: string;
  full_name: string;
  student_id: string;
  enrollment_year: number;
  research_topic: string;
  thesis_status: string;
  metadata: DoktorantMetadata | null;
  departments?: { name?: string | null } | null;
  supervisors?: SupervisorRecord | null;
};

function fieldClassName(extra = "") {
  return `w-full rounded-xl bg-[var(--surface-container-highest)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none ${extra}`;
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
  type = "text",
}: {
  label: string;
  value: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
        {label}
      </label>
      <input type={type} value={value} readOnly className={fieldClassName("cursor-default")} />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  rows = 3,
}: {
  label: string;
  value: string;
  rows?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
        {label}
      </label>
      <textarea value={value} rows={rows} readOnly className={fieldClassName("resize-none cursor-default")} />
    </div>
  );
}

function SelectField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
        {label}
      </label>
      <input type="text" value={value} readOnly className={fieldClassName("cursor-default")} />
    </div>
  );
}

export default function DoktorantProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [doktorant, setDoktorant] = useState<DoktorantRecord | null>(null);
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [reportCount, setReportCount] = useState(0);
  const [evaluationCount, setEvaluationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDoktorant() {
      setLoading(true);

      const { data } = await supabase
        .from("doktorantlar")
        .select(`
          *,
          departments(name),
          supervisors(full_name, academic_title, email, workplace, is_external, departments(name))
        `)
        .eq("id", params.id)
        .single();

      if (!data) {
        setDoktorant(null);
        setLoading(false);
        return;
      }

      const record = data as unknown as DoktorantRecord;
      const metadata = (record.metadata ?? {}) as DoktorantMetadata;

      const [{ data: userRow }, { count: reports }, { count: evaluations }] = await Promise.all([
        supabase.from("users").select("email").eq("id", record.auth_user_id).maybeSingle(),
        supabase.from("progress_reports").select("*", { count: "exact", head: true }).eq("doktorant_id", record.id),
        supabase.from("evaluations").select("*", { count: "exact", head: true }).eq("doktorant_id", record.id),
      ]);

      if (metadata.avatar_path) {
        const { data: signedAvatar } = await supabase.storage
          .from("doktorant-avatars")
          .createSignedUrl(metadata.avatar_path, 60 * 60);
        setAvatarUrl(signedAvatar?.signedUrl ?? "");
      } else {
        setAvatarUrl("");
      }

      setEmail(userRow?.email ?? "");
      setReportCount(reports ?? 0);
      setEvaluationCount(evaluations ?? 0);
      setDoktorant(record);
      setLoading(false);
    }

    fetchDoktorant();
  }, [params.id, supabase]);

  const form = useMemo<DoktorantFormState | null>(() => {
    if (!doktorant) return null;

    const metadata = (doktorant.metadata ?? {}) as DoktorantMetadata;
    const nameParts = splitFullName(doktorant.full_name);
    const supervisor = doktorant.supervisors ?? {};

    return {
      lastName: metadata.last_name ?? nameParts.lastName,
      firstName: metadata.first_name ?? nameParts.firstName,
      middleName: metadata.middle_name ?? nameParts.middleName,
      birthDate: metadata.birth_date ?? "",
      gender: metadata.gender ?? "Erkak",
      nationality: metadata.nationality ?? "O'zbek",
      citizenship: metadata.citizenship ?? "O'zbekiston Respublikasi",
      category: metadata.category ?? "Tayanch doktorantura (PhD)",
      scienceField: metadata.science_field ?? "Texnika fanlari",
      specialty: metadata.specialty ?? doktorant.student_id,
      studyStatus: metadata.study_status ?? (doktorantStatusLabels[doktorant.thesis_status] ?? doktorant.thesis_status),
      course: metadata.course ?? "1-kurs",
      paymentType: metadata.payment_type ?? "Davlat granti",
      department: doktorant.departments?.name ?? "Biriktirilmagan",
      admissionDate: metadata.admission_date ?? `${doktorant.enrollment_year}-09-01`,
      researchTopic: doktorant.research_topic ?? "",
      country: metadata.country ?? "O'zbekiston",
      region: metadata.region ?? "",
      district: metadata.district ?? "",
      address: metadata.address ?? "",
      supervisorName: supervisor.full_name ?? "",
      supervisorTitle: supervisor.academic_title ?? "",
      supervisorDegree: metadata.supervisor_degree ?? "",
      supervisorOrganization: supervisor.is_external
        ? supervisor.workplace ?? ""
        : supervisor.departments?.name ?? "Universitet xodimi",
      supervisorEmail: metadata.supervisor_email ?? supervisor.email ?? "",
      supervisorPhone: metadata.supervisor_phone ?? "",
      consultantName: metadata.consultant_name ?? "",
      consultantTitle: metadata.consultant_title ?? "",
      consultantDegree: metadata.consultant_degree ?? "",
    };
  }, [doktorant]);

  const progress = useMemo(() => {
    if (!doktorant) return 0;
    return doktorantProgressByStatus[doktorant.thesis_status] ?? 0;
  }, [doktorant]);

  if (loading) return <div className="p-10 text-center text-(--on-surface-variant)">Yuklanmoqda...</div>;
  if (!doktorant || !form) return <div className="p-10 text-center text-red-500">Doktorant topilmadi</div>;

  return (
    <div className="mx-auto max-w-7xl px-2 pb-16 pt-2">
      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] text-[var(--on-surface)]">
            Doktorant profili
          </h1>
          <p className="mt-2 text-sm font-medium text-[var(--on-surface-variant)]">
            Batafsil ko&apos;rinish doktorant yaratish jarayonidagi dossier tuzilmasi bilan bir xil ko&apos;rsatiladi.
          </p>
        </div>
        <Link href="/doktorantura">
          <Button variant="outline" size="md">
            Orqaga
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <section className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
            <SectionTitle>Login va identifikatsiya</SectionTitle>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Email" type="email" value={email} />
              <Field label="Parol" value="••••••••" />
              <Field label="Student ID" value={doktorant.student_id} />
              <Field label="Qabul qilingan yil" type="number" value={String(doktorant.enrollment_year)} />
              <Field label="Kafedra" value={form.department} />
              <Field label="Ilmiy rahbar" value={form.supervisorName || "Biriktirilmagan"} />
            </div>
          </section>

          <section className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
            <SectionTitle>Shaxsiy ma&apos;lumotlar</SectionTitle>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center">
                <div className="flex h-44 w-full max-w-[13rem] items-center justify-center overflow-hidden rounded-3xl bg-[var(--surface-container-low)] text-center text-[var(--on-surface-variant)]">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={doktorant.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center px-4">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/75 text-xl font-bold text-[var(--primary)]">
                        {form.firstName?.[0] ?? "D"}
                      </div>
                      <p className="text-sm font-semibold">Rasm yuklanmagan</p>
                    </div>
                  )}
                </div>
                <p className="mt-3 max-w-[12rem] text-center text-xs text-[var(--on-surface-variant)]">
                  Profil rasmi ilmiy bo&apos;lim, ilmiy rahbar va doktorant profilida bir xil ko&apos;rinadi.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:col-span-2 md:grid-cols-2">
                <Field label="Familiyasi" value={form.lastName} />
                <Field label="Ismi" value={form.firstName} />
                <Field label="Otasining ismi" value={form.middleName} />
                <Field label="Tug'ilgan sanasi" type="date" value={form.birthDate} />
                <SelectField label="Jinsi" value={form.gender} />
                <Field label="Millati" value={form.nationality} />
                <div className="md:col-span-2">
                  <Field label="Fuqaroligi" value={form.citizenship} />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
            <SectionTitle>Ta&apos;lim ma&apos;lumotlari</SectionTitle>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <SelectField label="Izlanuvchi toifasi" value={form.category} />
              <Field label="Fan sohasi" value={form.scienceField} />
              <div className="md:col-span-2">
                <Field label="Ixtisoslik" value={form.specialty} />
              </div>
              <SelectField label="Holati" value={form.studyStatus} />
              <Field label="Kurs" value={form.course} />
              <Field label="To'lov turi" value={form.paymentType} />
              <Field label="Qabul qilingan sana" type="date" value={form.admissionDate} />
              <div className="md:col-span-2">
                <Field label="Kafedra" value={form.department} />
              </div>
              <div className="md:col-span-2">
                <TextAreaField label="Dissertatsiya mavzusi" value={form.researchTopic} />
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
                    <Field label="F.I.Sh." value={form.supervisorName} />
                  </div>
                  <Field label="Unvoni" value={form.supervisorTitle} />
                  <Field label="Ilmiy darajasi" value={form.supervisorDegree} />
                  <div className="md:col-span-2">
                    <Field label="Tashkilot" value={form.supervisorOrganization} />
                  </div>
                  <Field label="Email" type="email" value={form.supervisorEmail} />
                  <Field label="Telefon" value={form.supervisorPhone} />
                </div>
              </div>

              <div className="rounded-3xl bg-[var(--surface-container-low)] p-5">
                <div className="mb-5 text-xs font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
                  Ilmiy maslahatchi (ixtiyoriy)
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Field label="F.I.Sh." value={form.consultantName} />
                  </div>
                  <Field label="Unvoni" value={form.consultantTitle} />
                  <Field label="Ilmiy darajasi" value={form.consultantDegree} />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8 lg:col-span-4">
          <section className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
            <SectionTitle accent="var(--tertiary)">Doimiy manzili</SectionTitle>
            <div className="space-y-5">
              <Field label="Mamlakat" value={form.country} />
              <Field label="Viloyat" value={form.region} />
              <Field label="Tuman" value={form.district} />
              <TextAreaField label="Manzil" value={form.address} />
            </div>
          </section>

          <section
            className="relative overflow-hidden rounded-3xl p-8 shadow-[0_30px_70px_rgba(31,50,82,0.28)]"
            style={{ background: "linear-gradient(135deg, #5c6f89 0%, #304764 100%)" }}
          >
            <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/18 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))]" />
            <div className="relative z-10">
              <h3 className="font-display text-lg font-bold text-white">Akademik progress</h3>
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
                  <input
                    type="text"
                    value={doktorantStatusLabels[doktorant.thesis_status] ?? doktorant.thesis_status}
                    readOnly
                    className="w-full rounded-2xl bg-white/12 px-4 py-3 text-sm font-medium text-white outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-white/65">Hisobotlar</p>
                    <p className="text-3xl font-bold text-white">{reportCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-white/65">Baholashlar</p>
                    <p className="text-3xl font-bold text-white">{evaluationCount}</p>
                  </div>
                </div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 text-sm font-medium text-white">
                  {doktorantStatusLabels[doktorant.thesis_status] ?? doktorant.thesis_status}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
