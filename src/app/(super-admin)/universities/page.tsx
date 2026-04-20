"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { University } from "@/types/db";

export default function UniversitiesPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<University | null>(null);
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Add-admin modal
  const [adminModalUni, setAdminModalUni] = useState<University | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: e } = await supabase
      .from("universities")
      .select("*")
      .order("created_at", { ascending: false });
    if (e) setError(e.message);
    else setRows((data as University[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setShortCode("");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (u: University) => {
    setEditing(u);
    setName(u.name);
    setShortCode(u.short_code);
    setFormError("");
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const trimmedName = name.trim();
    const trimmedCode = shortCode.trim().toUpperCase();
    if (!trimmedName || !trimmedCode) {
      setFormError("Nom va qisqa kod talab qilinadi.");
      return;
    }
    setSaving(true);
    const payload = { name: trimmedName, short_code: trimmedCode };
    const { error: e2 } = editing
      ? await supabase.from("universities").update(payload).eq("id", editing.id)
      : await supabase.from("universities").insert(payload);
    setSaving(false);
    if (e2) {
      setFormError(
        e2.code === "23505"
          ? "Bu qisqa kod allaqachon mavjud."
          : e2.message
      );
      return;
    }
    setModalOpen(false);
    load();
  };

  const openAddAdmin = (u: University) => {
    setAdminModalUni(u);
    setAdminEmail("");
    setAdminName("");
    setAdminPassword("");
    setAdminError("");
    setAdminSuccess("");
  };

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminModalUni) return;
    setAdminError("");
    setAdminSuccess("");
    setAdminSaving(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminEmail.trim(),
        password: adminPassword,
        display_name: adminName.trim(),
        role: "university_admin",
        university_id: adminModalUni.id,
      }),
    });
    setAdminSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAdminError(data?.error ?? `HTTP ${res.status}`);
      return;
    }
    setAdminSuccess(`Yaratildi: ${adminEmail}. Foydalanuvchi shu parol bilan kirishi mumkin.`);
    setAdminEmail("");
    setAdminName("");
    setAdminPassword("");
  };

  const remove = async (u: University) => {
    if (!confirm(`"${u.name}" universitetini o'chirishni tasdiqlaysizmi? Barcha bog'liq ma'lumotlar o'chiriladi.`)) return;
    const { error: e } = await supabase.from("universities").delete().eq("id", u.id);
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
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            Universitetlar
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Tizimdagi barcha universitetlarni boshqarish
          </p>
        </div>
        <Button onClick={openCreate}>+ Yangi universitet</Button>
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
          <div className="p-8 text-center text-surface-500">
            Hali universitet qo&apos;shilmagan.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Qisqa kod</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase">Yaratilgan</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-surface-50 dark:hover:bg-surface-900/30">
                  <td className="px-4 py-3 text-sm text-surface-900 dark:text-surface-100">{u.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-surface-700 dark:text-surface-300">{u.short_code}</td>
                  <td className="px-4 py-3 text-sm text-surface-500">
                    {new Date(u.created_at).toLocaleDateString("uz-UZ")}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openAddAdmin(u)}>
                      + Admin
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                      Tahrirlash
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => remove(u)}>
                      O&apos;chirish
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={!!adminModalUni}
        onClose={() => setAdminModalUni(null)}
        title={`Admin yaratish — ${adminModalUni?.name ?? ""}`}
      >
        <form onSubmit={createAdmin} className="space-y-4">
          {adminError && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800 text-danger-600 dark:text-danger-400 rounded-lg text-sm">
              {adminError}
            </div>
          )}
          {adminSuccess && (
            <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg text-sm">
              {adminSuccess}
            </div>
          )}
          <Input
            label="To'liq ism"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            required
            autoComplete="off"
          />
          <Input
            label="Vaqtinchalik parol (kamida 8 ta belgi)"
            type="text"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setAdminModalUni(null)}>
              Yopish
            </Button>
            <Button type="submit" isLoading={adminSaving}>
              Adminni yaratish
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Universitetni tahrirlash" : "Yangi universitet"}
      >
        <form onSubmit={save} className="space-y-4">
          {formError && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800 text-danger-600 dark:text-danger-400 rounded-lg text-sm">
              {formError}
            </div>
          )}
          <Input
            label="Nomi"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="O'zbekiston Jahon Tillari Universiteti"
            required
          />
          <Input
            label="Qisqa kod"
            value={shortCode}
            onChange={(e) => setShortCode(e.target.value.toUpperCase())}
            placeholder="UZSLU"
            maxLength={16}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" isLoading={saving}>
              {editing ? "Saqlash" : "Yaratish"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
