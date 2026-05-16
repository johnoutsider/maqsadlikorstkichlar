"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { AcademicYear, University } from "@/types/db";

export default function UniversitySettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const [university, setUniversity] = useState<University | null>(null);
  const [name, setName] = useState("");
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [loginLogoPreviewUrl, setLoginLogoPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingLoginLogo, setUploadingLoginLogo] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Academic years
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [yearName, setYearName] = useState("");
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [yearIsActive, setYearIsActive] = useState(false);
  const [yearSaving, setYearSaving] = useState(false);
  const [yearError, setYearError] = useState("");

  const loadYears = useCallback(async () => {
    if (!user?.university_id) return;
    const { data } = await supabase
      .from("academic_years")
      .select("*")
      .eq("university_id", user.university_id)
      .order("name");
    setYears((data as AcademicYear[]) ?? []);
  }, [supabase, user?.university_id]);

  const load = useCallback(async () => {
    if (!user) return;
    if (user.role !== "university_admin" || !user.university_id) {
      router.replace("/overview");
      return;
    }

    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("universities")
      .select("*")
      .eq("id", user.university_id)
      .single();

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const record = data as University;
    setUniversity(record);
    setName(record.name);

    if (record.logo_url) {
      const { data: signedLogo } = await supabase.storage
        .from("university-logos")
        .createSignedUrl(record.logo_url, 60 * 60);
      setLogoPreviewUrl(signedLogo?.signedUrl ?? "");
    } else {
      setLogoPreviewUrl("");
    }

    if (record.login_logo_url) {
      const { data: signedLoginLogo } = await supabase.storage
        .from("university-logos")
        .createSignedUrl(record.login_logo_url, 60 * 60);
      setLoginLogoPreviewUrl(signedLoginLogo?.signedUrl ?? "");
    } else {
      setLoginLogoPreviewUrl("");
    }

    await loadYears();
    setLoading(false);
  }, [router, supabase, user, loadYears]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreateYear = () => {
    setEditingYear(null);
    setYearName("");
    setYearStart("");
    setYearEnd("");
    setYearIsActive(years.length === 0);
    setYearError("");
    setYearModalOpen(true);
  };

  const openEditYear = (y: AcademicYear) => {
    setEditingYear(y);
    setYearName(y.name);
    setYearStart(y.start_date);
    setYearEnd(y.end_date);
    setYearIsActive(y.is_active);
    setYearError("");
    setYearModalOpen(true);
  };

  const saveYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setYearError("");
    if (!user?.university_id) return;
    const trimmed = yearName.trim();
    if (!trimmed || !yearStart || !yearEnd) {
      setYearError("Barcha maydonlar talab qilinadi.");
      return;
    }
    setYearSaving(true);
    const payload = {
      name: trimmed,
      start_date: yearStart,
      end_date: yearEnd,
      is_active: yearIsActive,
      university_id: user.university_id,
    };
    const { error: err } = editingYear
      ? await supabase.from("academic_years").update(payload).eq("id", editingYear.id)
      : await supabase.from("academic_years").insert(payload);
    setYearSaving(false);
    if (err) {
      setYearError(
        err.code === "23505" ? "Bu universitetda faol o'quv yili allaqachon mavjud." : err.message
      );
      return;
    }
    setYearModalOpen(false);
    loadYears();
  };

  const deleteYear = async (y: AcademicYear) => {
    if (!confirm(`"${y.name}" o'quv yilini o'chirishni tasdiqlaysizmi?`)) return;
    const { error: err } = await supabase.from("academic_years").delete().eq("id", y.id);
    if (err) { alert(err.message); return; }
    loadYears();
  };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!university) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Universitet nomi talab qilinadi.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const { error: updateError } = await supabase
      .from("universities")
      .update({ name: trimmedName })
      .eq("id", university.id);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    const nextUniversity = { ...university, name: trimmedName };
    setUniversity(nextUniversity);
    window.dispatchEvent(new CustomEvent("university-brand:updated", {
      detail: {
        name: nextUniversity.name,
        shortCode: nextUniversity.short_code,
        logoPath: nextUniversity.logo_url,
        logoUrl: logoPreviewUrl,
      },
    }));
    setMessage("Universitet ma'lumotlari saqlandi.");
  };

  const uploadLogo = async (file: File | null) => {
    if (!file || !university) return;

    setUploading(true);
    setError("");
    setMessage("");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${university.id}/logo.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("university-logos")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("universities")
        .update({ logo_url: path })
        .eq("id", university.id);

      if (updateError) throw updateError;

      const { data: signedLogo } = await supabase.storage
        .from("university-logos")
        .createSignedUrl(path, 60 * 60);

      const nextLogoUrl = signedLogo?.signedUrl ?? "";
      const nextUniversity = { ...university, logo_url: path };
      setLogoPreviewUrl(nextLogoUrl);
      setUniversity(nextUniversity);
      window.dispatchEvent(new CustomEvent("university-brand:updated", {
        detail: {
          name: nextUniversity.name,
          shortCode: nextUniversity.short_code,
          logoPath: path,
          logoUrl: nextLogoUrl,
        },
      }));
      setMessage("Universitet logotipi yangilandi.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Logotipni yuklashda xatolik yuz berdi.");
    } finally {
      setUploading(false);
    }
  };

  const uploadLoginLogo = async (file: File | null) => {
    if (!file || !university) return;

    setUploadingLoginLogo(true);
    setError("");
    setMessage("");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${university.id}/login-logo.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("university-logos")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("universities")
        .update({ login_logo_url: path })
        .eq("id", university.id);

      if (updateError) throw updateError;

      const { data: signedLogo } = await supabase.storage
        .from("university-logos")
        .createSignedUrl(path, 60 * 60);

      setLoginLogoPreviewUrl(signedLogo?.signedUrl ?? "");
      setUniversity({ ...university, login_logo_url: path });
      setMessage("Kirish sahifasi logotipi yangilandi.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Logotipni yuklashda xatolik yuz berdi.");
    } finally {
      setUploadingLoginLogo(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>;
  }

  if (!university) {
    return <div className="p-8 text-center text-danger-600 dark:text-danger-400">Universitet topilmadi.</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Universitet Sozlamalari</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Universitet nomi va sidebar logotipini boshqarish
        </p>
      </div>

      {(error || message) && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            error
              ? "bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800 text-danger-600 dark:text-danger-400"
              : "bg-surface-50 dark:bg-surface-900/30 border border-surface-200 dark:border-surface-700 text-success-600 dark:text-success-400"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        <form onSubmit={saveName} className="p-6 border-b border-surface-200 dark:border-surface-700">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">Universitet Ma&apos;lumotlari</h2>
          <div className="mt-4 max-w-xl">
            <Input label="Universitet nomi" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="mt-5">
            <Button type="submit" isLoading={saving}>Saqlash</Button>
          </div>
        </form>

        <section className="p-6 border-b border-surface-200 dark:border-surface-700">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">Logotip</h2>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <label className="group flex h-32 w-32 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-surface-300 bg-surface-50 text-surface-500 transition hover:bg-surface-100 dark:border-surface-600 dark:bg-surface-900/40 dark:text-surface-400 dark:hover:bg-surface-900">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => uploadLogo(e.target.files?.[0] ?? null)}
              />
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt="Universitet logotipi" className="h-full w-full object-cover" />
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M9 21V7l4-4 4 4v14M9 12h6" />
                </svg>
              )}
            </label>
            <div>
              <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                {uploading ? "Yuklanmoqda..." : logoPreviewUrl ? "Logotipni almashtirish" : "Logotip yuklash"}
              </p>
              <p className="mt-1 max-w-md text-sm text-surface-500 dark:text-surface-400">
                PNG, JPG yoki WEBP formatidagi logotipni yuklang. Fayl universitet papkasida saqlanadi va sidebar brendingida ko&apos;rinadi.
              </p>
            </div>
          </div>
        </section>

        <section className="p-6 border-b border-surface-200 dark:border-surface-700">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">Kirish sahifasi logotipi</h2>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <label className="group flex h-32 w-32 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-surface-300 bg-surface-50 text-surface-500 transition hover:bg-surface-100 dark:border-surface-600 dark:bg-surface-900/40 dark:text-surface-400 dark:hover:bg-surface-900">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => uploadLoginLogo(e.target.files?.[0] ?? null)}
              />
              {loginLogoPreviewUrl ? (
                <img src={loginLogoPreviewUrl} alt="Kirish sahifasi logotipi" className="h-full w-full object-cover" />
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M9 21V7l4-4 4 4v14M9 12h6" />
                </svg>
              )}
            </label>
            <div>
              <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                {uploadingLoginLogo ? "Yuklanmoqda..." : loginLogoPreviewUrl ? "Logotipni almashtirish" : "Logotip yuklash"}
              </p>
              <p className="mt-1 max-w-md text-sm text-surface-500 dark:text-surface-400">
                Kirish sahifasida ko&apos;rsatiladigan logotip. Sidebar logotipidan alohida saqlanadi.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Academic Years */}
      <div className="mt-6 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">O'quv yillari</h2>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
              O'quv jarayoni uchun yillar. Bir vaqtda faqat bitta faol yil bo'lishi mumkin.
            </p>
          </div>
          <Button onClick={openCreateYear}>+ Yangi yil</Button>
        </div>

        {years.length === 0 ? (
          <div className="p-6 text-center text-sm text-surface-500">O'quv yili mavjud emas.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-50 dark:bg-surface-900/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-surface-500 uppercase">Yil nomi</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-surface-500 uppercase">Boshlanish</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-surface-500 uppercase">Tugash</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-surface-500 uppercase">Holat</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {years.map(y => (
                <tr key={y.id} className="hover:bg-surface-50 dark:hover:bg-surface-900/30">
                  <td className="px-5 py-3 font-medium">{y.name}</td>
                  <td className="px-5 py-3 text-surface-500">{y.start_date}</td>
                  <td className="px-5 py-3 text-surface-500">{y.end_date}</td>
                  <td className="px-5 py-3">
                    {y.is_active ? (
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                        Faol
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-surface-100 text-surface-500 dark:bg-surface-700 dark:text-surface-400">
                        Nofaol
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openEditYear(y)}>Tahrirlash</Button>
                    {!y.is_active && (
                      <Button variant="danger" size="sm" onClick={() => deleteYear(y)}>O'chirish</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Academic Year Modal */}
      <Modal
        isOpen={yearModalOpen}
        onClose={() => setYearModalOpen(false)}
        title={editingYear ? "O'quv yilini tahrirlash" : "Yangi o'quv yili"}
      >
        <form onSubmit={saveYear} className="space-y-4">
          {yearError && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{yearError}</div>
          )}
          <Input
            label="Yil nomi"
            value={yearName}
            onChange={e => setYearName(e.target.value)}
            placeholder="2024-2025"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Boshlanish sanasi"
              type="date"
              value={yearStart}
              onChange={e => setYearStart(e.target.value)}
              required
            />
            <Input
              label="Tugash sanasi"
              type="date"
              value={yearEnd}
              onChange={e => setYearEnd(e.target.value)}
              required
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={yearIsActive}
              onChange={e => setYearIsActive(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-surface-700 dark:text-surface-300">
              Faol o'quv yili sifatida belgilash
            </span>
          </label>
          {yearIsActive && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Faol qilinganda, avvalgi faol yil avtomatik nofaol bo'lmaydi — DB darajasida unique constraint bor. Avval boshqasini nofaol qiling.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setYearModalOpen(false)}>Bekor qilish</Button>
            <Button type="submit" isLoading={yearSaving}>{editingYear ? "Saqlash" : "Yaratish"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
