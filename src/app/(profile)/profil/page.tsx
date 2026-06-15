"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ROLE_LABELS } from "@/lib/role-labels";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="h-7 w-1.5 rounded-full" style={{ background: "var(--primary)" }} />
      <h2 className="font-display text-xl font-bold text-[var(--on-surface)]">{children}</h2>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <label className="px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--on-surface-variant)]">
        {label}
      </label>
      <div
        className="w-full rounded-lg px-3.5 py-2.5 text-sm"
        style={{ background: "var(--surface-container-highest)", color: "var(--on-surface)" }}
      >
        {value || "-"}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const supabase = createClient();
  const { user, refresh } = useSupabaseAuth();

  const [displayName, setDisplayName] = useState("");
  const [facultyName, setFacultyName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
  const [nameError, setNameError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (user) setDisplayName(user.display_name);
  }, [user]);

  useEffect(() => {
    async function loadScope() {
      if (!user) return;
      if (user.faculty_id) {
        const { data } = await supabase.from("faculties").select("name").eq("id", user.faculty_id).maybeSingle();
        setFacultyName(data?.name ?? "");
      } else {
        setFacultyName("");
      }
      if (user.department_id) {
        const { data } = await supabase.from("departments").select("name").eq("id", user.department_id).maybeSingle();
        setDepartmentName(data?.name ?? "");
      } else {
        setDepartmentName("");
      }
    }
    loadScope();
  }, [supabase, user]);

  if (!user) return null;

  const handleSaveName = async () => {
    setNameMessage("");
    setNameError("");

    const trimmed = displayName.trim();
    if (!trimmed) {
      setNameError("Ism bo'sh bo'lishi mumkin emas.");
      return;
    }

    setSavingName(true);
    const { error } = await supabase.from("users").update({ display_name: trimmed }).eq("id", user.id);
    setSavingName(false);

    if (error) {
      setNameError(error.message);
      return;
    }

    await refresh();
    setNameMessage("Ism muvaffaqiyatli saqlandi.");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("Parol kamida 8 ta belgidan iborat bo'lishi kerak.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Parollar bir xil emas.");
      return;
    }

    setSavingPassword(true);

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setSavingPassword(false);
      setPasswordError(updateError.message);
      return;
    }

    if (user.must_change_password) {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ must_change_password: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSavingPassword(false);
        setPasswordError(data?.error ?? "Parol bayrog'ini yangilashda xatolik yuz berdi.");
        return;
      }
    }

    await refresh();
    setSavingPassword(false);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("Parol muvaffaqiyatli o'zgartirildi.");
  };

  const roleNames = Array.from(new Set([user.role, ...user.roles_granted.map((r) => r.name)]));

  return (
    <div className="mx-auto max-w-4xl px-2 pb-16 pt-2">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-[var(--on-surface)]">
          Mening profilim
        </h1>
        <p className="mt-2 text-sm font-medium text-[var(--on-surface-variant)]">
          Shaxsiy ma&apos;lumotlar va hisob xavfsizligi sozlamalari.
        </p>
      </div>

      {user.must_change_password && (
        <div
          className="mb-6 rounded-2xl px-5 py-4 text-sm font-medium"
          style={{ background: "#ffdad6", color: "#7a1c1c" }}
        >
          Davom etishdan oldin, xavfsizlik maqsadida parolingizni o&apos;zgartiring.
        </div>
      )}

      <div className="space-y-8">
        <section
          className="rounded-3xl p-6 sm:p-8"
          style={{ background: "var(--surface-container-lowest)", boxShadow: "0 24px 60px rgba(42,52,57,0.06)" }}
        >
          <SectionTitle>Profil ma&apos;lumotlari</SectionTitle>

          {(nameMessage || nameError) && (
            <div
              className="mb-4 rounded-xl px-4 py-3 text-sm font-medium"
              style={{
                background: nameError ? "#ffdad6" : "var(--surface-container-high)",
                color: nameError ? "#7a1c1c" : "var(--on-surface)",
              }}
            >
              {nameError || nameMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Input label="To'liq ism" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <ReadOnlyField label="Login (Email)" value={user.email} />
            <ReadOnlyField label="Rol(lar)" value={roleNames.map((r) => ROLE_LABELS[r] ?? r).join(", ")} />
            {user.phone && <ReadOnlyField label="Telefon" value={user.phone} />}
            {facultyName && <ReadOnlyField label="Fakultet" value={facultyName} />}
            {departmentName && <ReadOnlyField label="Kafedra" value={departmentName} />}
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="button" variant="primary" size="md" isLoading={savingName} onClick={handleSaveName}>
              Ismni saqlash
            </Button>
          </div>
        </section>

        <section
          className="rounded-3xl p-6 sm:p-8"
          style={{ background: "var(--surface-container-lowest)", boxShadow: "0 24px 60px rgba(42,52,57,0.06)" }}
        >
          <SectionTitle>Parolni o&apos;zgartirish</SectionTitle>

          {(passwordMessage || passwordError) && (
            <div
              className="mb-4 rounded-xl px-4 py-3 text-sm font-medium"
              style={{
                background: passwordError ? "#ffdad6" : "var(--surface-container-high)",
                color: passwordError ? "#7a1c1c" : "var(--on-surface)",
              }}
            >
              {passwordError || passwordMessage}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Input
              label="Yangi parol"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
            />
            <Input
              label="Yangi parolni tasdiqlang"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
            />
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" variant="primary" size="md" isLoading={savingPassword}>
                Parolni o&apos;zgartirish
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
