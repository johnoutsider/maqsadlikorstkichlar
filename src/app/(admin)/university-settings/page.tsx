"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { University } from "@/types/db";

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

    setLoading(false);
  }, [router, supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

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

        <section className="p-6">
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
    </div>
  );
}
