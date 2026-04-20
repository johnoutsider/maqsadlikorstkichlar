"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { Faculty, AppUser } from "@/types/db";

interface UserWithRole extends AppUser {
  role_name: string;
}

export default function FacultiesPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const [rows, setRows] = useState<Faculty[]>([]);
  const [deans, setDeans] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Faculty | null>(null);
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [deanId, setDeanId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    if (!user?.university_id) return;
    setLoading(true);
    setError("");
    const [{ data: f, error: fErr }, { data: u }] = await Promise.all([
      supabase.from("faculties").select("*").eq("university_id", user.university_id).order("short_code"),
      supabase
        .from("users")
        .select("*, roles!inner(name)")
        .eq("university_id", user.university_id),
    ]);
    if (fErr) setError(fErr.message);
    else setRows((f as Faculty[]) ?? []);
    setDeans(
      ((u as any[]) ?? [])
        .filter((x) => x.roles?.name === "dean")
        .map((x) => ({ ...x, role_name: x.roles.name }))
    );
    setLoading(false);
  }, [supabase, user?.university_id]);

  useEffect(() => {
    load();
  }, [load]);

  const deanNameById = useMemo(() => {
    const m = new Map<string, string>();
    deans.forEach((d) => m.set(d.id, d.display_name));
    return m;
  }, [deans]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setShortCode("");
    setDeanId("");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (f: Faculty) => {
    setEditing(f);
    setName(f.name);
    setShortCode(f.short_code);
    setDeanId(f.dean_user_id ?? "");
    setFormError("");
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!user?.university_id) return;
    const trimmedName = name.trim();
    const trimmedCode = shortCode.trim().toUpperCase();
    if (!trimmedName || !trimmedCode) {
      setFormError("Nom va qisqa kod talab qilinadi.");
      return;
    }
    setSaving(true);
    const payload = {
      name: trimmedName,
      short_code: trimmedCode,
      dean_user_id: deanId || null,
      university_id: user.university_id,
    };
    const { error: e2 } = editing
      ? await supabase.from("faculties").update(payload).eq("id", editing.id)
      : await supabase.from("faculties").insert(payload);
    setSaving(false);
    if (e2) {
      setFormError(e2.code === "23505" ? "Bu qisqa kod allaqachon mavjud." : e2.message);
      return;
    }
    setModalOpen(false);
    load();
  };

  const remove = async (f: Faculty) => {
    if (!confirm(`"${f.name}" fakultetini o'chirishni tasdiqlaysizmi? Bog'liq bo'limlar va hisobotlar ham o'chiriladi.`)) return;
    const { error: e } = await supabase.from("faculties").delete().eq("id", f.id);
    if (e) {
      alert(e.message);
      return;
    }
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Fakultetlar</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Universitet fakultetlarini boshqarish va dekanlarni biriktirish
          </p>
        </div>
        <Button onClick={openCreate}>+ Yangi fakultet</Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800 text-danger-600 dark:text-danger-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-surface-500">Hali fakultet qo&apos;shilmagan.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Kod</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Dekan</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {rows.map((f) => (
                <tr key={f.id} className="hover:bg-surface-50 dark:hover:bg-surface-900/30">
                  <td className="px-4 py-3 text-sm text-surface-900 dark:text-surface-100">{f.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-surface-700 dark:text-surface-300">{f.short_code}</td>
                  <td className="px-4 py-3 text-sm text-surface-700 dark:text-surface-300">
                    {f.dean_user_id ? (deanNameById.get(f.dean_user_id) ?? "—") : <span className="text-surface-400">tayinlanmagan</span>}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(f)}>Tahrirlash</Button>
                    <Button variant="danger" size="sm" onClick={() => remove(f)}>O&apos;chirish</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Fakultetni tahrirlash" : "Yangi fakultet"}>
        <form onSubmit={save} className="space-y-4">
          {formError && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800 text-danger-600 dark:text-danger-400 rounded-lg text-sm">
              {formError}
            </div>
          )}
          <Input label="Nomi" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label="Qisqa kod"
            value={shortCode}
            onChange={(e) => setShortCode(e.target.value.toUpperCase())}
            placeholder="ENG1"
            maxLength={16}
            required
          />
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Dekan (ixtiyoriy)
            </label>
            <select
              value={deanId}
              onChange={(e) => setDeanId(e.target.value)}
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
            >
              <option value="">— tayinlanmagan —</option>
              {deans.map((d) => (
                <option key={d.id} value={d.id}>{d.display_name} ({d.email})</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-surface-500">
              Dekan foydalanuvchisi avval &quot;Foydalanuvchilar&quot; sahifasida yaratilishi kerak.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button type="submit" isLoading={saving}>{editing ? "Saqlash" : "Yaratish"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
