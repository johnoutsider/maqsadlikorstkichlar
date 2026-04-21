"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import {
  buildDoktorantMetadata,
  buildFullName,
  doktorantProgressByStatus,
  doktorantStatusLabels,
  splitFullName,
  type DoktorantFormState,
  type DoktorantMetadata,
} from "@/lib/doktorant-profile";

type SupervisorRecord = {
  full_name?: string;
  academic_title?: string;
  is_external?: boolean;
  workplace?: string | null;
  departments?: { name?: string | null } | null;
};

type DoktorantRecord = {
  id: string;
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
  placeholder,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
        {label}
      </label>
      <textarea
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={fieldClassName(`resize-none ${readOnly ? "cursor-default" : ""}`)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
        {label}
      </label>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={fieldClassName(disabled ? "cursor-default" : "")}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function MyProfilePage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const [doktorant, setDoktorant] = useState<DoktorantRecord | null>(null);
  const [form, setForm] = useState<DoktorantFormState | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [reportCount, setReportCount] = useState(0);
  const [evaluationCount, setEvaluationCount] = useState(0);
  const [progressStatus, setProgressStatus] = useState("taklif");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchDoc() {
      if (!user) return;

      setLoading(true);
      setError("");

      const { data } = await supabase
        .from("doktorantlar")
        .select(`
          *,
          departments(name),
          supervisors(full_name, academic_title, is_external, workplace, departments(name))
        `)
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!data) {
        setDoktorant(null);
        setForm(null);
        setLoading(false);
        return;
      }

      const record = data as unknown as DoktorantRecord;
      const metadata = (record.metadata ?? {}) as DoktorantMetadata;
      const nameParts = splitFullName(record.full_name);
      const supervisor = record.supervisors ?? {};

      const [{ count: reports }, { count: evaluations }] = await Promise.all([
        supabase
          .from("progress_reports")
          .select("*", { count: "exact", head: true })
          .eq("doktorant_id", record.id),
        supabase
          .from("evaluations")
          .select("*", { count: "exact", head: true })
          .eq("doktorant_id", record.id),
      ]);

      setReportCount(reports ?? 0);
      setEvaluationCount(evaluations ?? 0);
      if (metadata.avatar_path) {
        const { data: signedAvatar } = await supabase.storage
          .from("doktorant-avatars")
          .createSignedUrl(metadata.avatar_path, 60 * 60);
        setAvatarUrl(signedAvatar?.signedUrl ?? "");
      } else {
        setAvatarUrl("");
      }
      setDoktorant(record);
      setForm({
        lastName: metadata.last_name ?? nameParts.lastName,
        firstName: metadata.first_name ?? nameParts.firstName,
        middleName: metadata.middle_name ?? nameParts.middleName,
        birthDate: metadata.birth_date ?? "",
        gender: metadata.gender ?? "Erkak",
        nationality: metadata.nationality ?? "O'zbek",
        citizenship: metadata.citizenship ?? "O'zbekiston Respublikasi",
        category: metadata.category ?? "Tayanch doktorantura (PhD)",
        scienceField: metadata.science_field ?? "Texnika fanlari",
        specialty: metadata.specialty ?? record.student_id,
        studyStatus: metadata.study_status ?? (doktorantStatusLabels[record.thesis_status] ?? record.thesis_status),
        course: metadata.course ?? "2-kurs",
        paymentType: metadata.payment_type ?? "Davlat granti",
        department: record.departments?.name ?? "Biriktirilmagan",
        admissionDate: metadata.admission_date ?? `${record.enrollment_year}-09-01`,
        researchTopic: record.research_topic ?? "",
        country: metadata.country ?? "O'zbekiston",
        region: metadata.region ?? "Toshkent shahri",
        district: metadata.district ?? "Mirzo Ulug'bek tumani",
        address: metadata.address ?? "",
        supervisorName: supervisor.full_name ?? "",
        supervisorTitle: supervisor.academic_title ?? "",
        supervisorDegree: metadata.supervisor_degree ?? "",
        supervisorOrganization: supervisor.is_external
          ? supervisor.workplace ?? ""
          : supervisor.departments?.name ?? "Universitet xodimi",
        supervisorEmail: metadata.supervisor_email ?? "",
        supervisorPhone: metadata.supervisor_phone ?? "",
        consultantName: metadata.consultant_name ?? "",
        consultantTitle: metadata.consultant_title ?? "",
        consultantDegree: metadata.consultant_degree ?? "",
      });
      setProgressStatus(record.thesis_status);
      setLoading(false);
    }

    fetchDoc();
  }, [supabase, user]);

  const progress = useMemo(() => {
    if (!doktorant) return 0;
    return doktorantProgressByStatus[progressStatus] ?? 0;
  }, [doktorant, progressStatus]);

  const updateForm = <K extends keyof DoktorantFormState>(key: K, value: DoktorantFormState[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = async () => {
    if (!doktorant || !form) return;

    setSaving(true);
    setError("");
    setMessage("");

    const fullName = buildFullName(form.lastName, form.firstName, form.middleName);
    const payloadMetadata: DoktorantMetadata = {
      ...buildDoktorantMetadata(form),
    };

    const { error: updateError } = await supabase
      .from("doktorantlar")
      .update({
        research_topic: form.researchTopic,
        thesis_status: progressStatus,
        metadata: payloadMetadata,
      })
      .eq("id", doktorant.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setDoktorant((current) =>
      current
        ? {
            ...current,
            research_topic: form.researchTopic,
            thesis_status: progressStatus,
            metadata: payloadMetadata,
          }
        : current
    );
    setMessage("Ma'lumotlar yangilandi.");
    setSaving(false);
  };

  const handleAvatarUpload = async (file: File | null) => {
    if (!file || !doktorant) return;

    setUploadingAvatar(true);
    setError("");
    setMessage("");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${doktorant.id}/avatar.${extension}`;
      const metadata = (doktorant.metadata ?? {}) as DoktorantMetadata;

      const { error: uploadError } = await supabase.storage
        .from("doktorant-avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const nextMetadata: DoktorantMetadata = {
        ...metadata,
        avatar_path: filePath,
      };

      const { error: updateError } = await supabase
        .from("doktorantlar")
        .update({ metadata: nextMetadata })
        .eq("id", doktorant.id);

      if (updateError) {
        throw updateError;
      }

      const { data: signedAvatar } = await supabase.storage
        .from("doktorant-avatars")
        .createSignedUrl(filePath, 60 * 60);

      setAvatarUrl(signedAvatar?.signedUrl ?? "");
      setDoktorant((current) =>
        current
          ? {
              ...current,
              metadata: nextMetadata,
            }
          : current
      );
      setMessage("Profil rasmi yangilandi.");
    } catch (err: any) {
      setError(err.message ?? "Rasmni yuklashda xatolik yuz berdi.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-(--on-surface-variant)">Yuklanmoqda...</div>;
  if (!doktorant || !form) return <div className="p-10 text-center text-red-500">Profil topilmadi</div>;

  return (
    <div className="mx-auto max-w-7xl px-2 pb-16 pt-2">
      <div className="mb-10">
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] text-[var(--on-surface)]">
          Doktorant profili
        </h1>
        <p className="mt-2 text-sm font-medium text-[var(--on-surface-variant)]">
          Manage and refine your academic dossier within the atelier.
        </p>
      </div>

      {(message || error) && (
        <div
          className="mb-6 rounded-2xl px-5 py-4 text-sm font-medium"
          style={{
            background: error ? "#ffdad6" : "var(--surface-container)",
            color: error ? "#7a1c1c" : "var(--on-surface)",
          }}
        >
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <section className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
            <SectionTitle>Shaxsiy ma&apos;lumotlar</SectionTitle>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center">
                <div className="relative flex h-44 w-full max-w-[13rem] flex-col items-center justify-center overflow-hidden rounded-3xl bg-[var(--surface-container-low)] px-4 text-center text-[var(--on-surface-variant)]">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Doktorant avatar" className="h-full w-full object-cover" />
                  ) : (
                    <>
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/75 text-xl font-bold text-[var(--primary)]">
                        {form.firstName?.[0] ?? "D"}
                      </div>
                      <p className="text-sm font-semibold">Profil rasmi</p>
                    </>
                  )}
                </div>
                <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white shadow-[0_12px_28px_rgba(31,50,82,0.18)]">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => handleAvatarUpload(e.target.files?.[0] ?? null)}
                  />
                  {uploadingAvatar ? "Yuklanmoqda..." : avatarUrl ? "Rasmni o'zgartirish" : "Rasm yuklash"}
                </label>
                <p className="mt-3 max-w-[11rem] text-center text-xs text-[var(--on-surface-variant)]">
                  JPG, PNG yoki WEBP formatdagi profil rasmini yuklang. Rasm ilmiy bo&apos;lim va ilmiy rahbar uchun ham ko&apos;rinadi.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:col-span-2 md:grid-cols-2">
                <Field label="Familiyasi" value={form.lastName} onChange={(value) => updateForm("lastName", value)} readOnly />
                <Field label="Ismi" value={form.firstName} onChange={(value) => updateForm("firstName", value)} readOnly />
                <Field label="Otasining ismi" value={form.middleName} onChange={(value) => updateForm("middleName", value)} readOnly />
                <Field label="Tug'ilgan sanasi" type="date" value={form.birthDate} onChange={(value) => updateForm("birthDate", value)} readOnly />
                <SelectField label="Jinsi" value={form.gender} onChange={(value) => updateForm("gender", value)} options={["Erkak", "Ayol"]} disabled />
                <Field label="Millati" value={form.nationality} onChange={(value) => updateForm("nationality", value)} readOnly />
                <div className="md:col-span-2">
                  <Field label="Fuqaroligi" value={form.citizenship} onChange={(value) => updateForm("citizenship", value)} readOnly />
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
                  disabled
                />
                <Field label="Fan sohasi" value={form.scienceField} onChange={(value) => updateForm("scienceField", value)} readOnly />
                <div className="md:col-span-2">
                  <Field label="Ixtisoslik" value={form.specialty} onChange={(value) => updateForm("specialty", value)} readOnly />
                </div>
                <Field label="Holati" value={form.studyStatus} onChange={(value) => updateForm("studyStatus", value)} readOnly />
                <Field label="Kurs" value={form.course} onChange={(value) => updateForm("course", value)} readOnly />
                <Field label="To'lov turi" value={form.paymentType} onChange={(value) => updateForm("paymentType", value)} readOnly />
                <Field label="Qabul qilingan sana" type="date" value={form.admissionDate} onChange={(value) => updateForm("admissionDate", value)} readOnly />
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
                  <Field label="Ilmiy darajasi" value={form.supervisorDegree} onChange={(value) => updateForm("supervisorDegree", value)} readOnly />
                  <div className="md:col-span-2">
                    <Field
                      label="Tashkilot"
                      value={form.supervisorOrganization}
                      onChange={(value) => updateForm("supervisorOrganization", value)}
                      readOnly
                    />
                  </div>
                  <Field label="Email" type="email" value={form.supervisorEmail} onChange={(value) => updateForm("supervisorEmail", value)} readOnly />
                  <Field label="Telefon" value={form.supervisorPhone} onChange={(value) => updateForm("supervisorPhone", value)} readOnly />
                </div>
              </div>

              <div className="rounded-3xl bg-[var(--surface-container-low)] p-5">
                <div className="mb-5 text-xs font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
                  Ilmiy maslahatchi (ixtiyoriy)
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Field
                      label="F.I.Sh."
                      value={form.consultantName}
                      onChange={(value) => updateForm("consultantName", value)}
                      placeholder="Ism sharifni kiriting"
                      readOnly
                    />
                  </div>
                  <Field
                    label="Unvoni"
                    value={form.consultantTitle}
                    onChange={(value) => updateForm("consultantTitle", value)}
                    placeholder="Masalan: Dotsent"
                    readOnly
                  />
                  <Field
                    label="Ilmiy darajasi"
                    value={form.consultantDegree}
                    onChange={(value) => updateForm("consultantDegree", value)}
                    placeholder="Masalan: PhD"
                    readOnly
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8 lg:col-span-4">
          <section className="rounded-3xl bg-[var(--surface-container-lowest)] p-6 shadow-[0_24px_60px_rgba(42,52,57,0.06)] sm:p-8">
            <SectionTitle accent="var(--tertiary)">Doimiy manzili</SectionTitle>
            <div className="space-y-5">
                <Field label="Mamlakat" value={form.country} onChange={(value) => updateForm("country", value)} readOnly />
                <Field label="Viloyat" value={form.region} onChange={(value) => updateForm("region", value)} readOnly />
                <Field label="Tuman" value={form.district} onChange={(value) => updateForm("district", value)} readOnly />
                <TextAreaField label="Manzil" value={form.address} onChange={(value) => updateForm("address", value)} readOnly />
              </div>
            </section>

          <section
            className="relative overflow-hidden rounded-3xl p-8 shadow-[0_30px_70px_rgba(31,50,82,0.28)]"
            style={{ background: "linear-gradient(135deg, #5c6f89 0%, #304764 100%)" }}
          >
            <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/18 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))]" />
            <div className="relative z-10">
              <h3 className="font-display text-lg font-bold text-white">Akademik daraja</h3>
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
                    value={progressStatus}
                    onChange={(e) => setProgressStatus(e.target.value)}
                    className="w-full rounded-2xl bg-white/12 px-4 py-3 text-sm font-medium text-white outline-none"
                  >
                    {Object.entries(doktorantStatusLabels).map(([key, label]) => (
                      <option key={key} value={key} className="text-slate-900">
                        {label}
                      </option>
                    ))}
                  </select>
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
                  {doktorantStatusLabels[progressStatus] ?? progressStatus}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="mt-14 flex flex-wrap items-center justify-end gap-4">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => {
            setMessage("");
            setError("");
            window.location.reload();
          }}
        >
          Bekor qilish
        </Button>
        <Button type="button" variant="primary" size="md" isLoading={saving} onClick={handleSave}>
          Ma&apos;lumotlarni saqlash
        </Button>
      </div>
    </div>
  );
}
