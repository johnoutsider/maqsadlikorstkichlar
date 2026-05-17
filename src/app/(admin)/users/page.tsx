"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { Faculty, Department, RoleName } from "@/types/db";

interface Row {
  id: string;
  display_name: string;
  email: string;
  role_id: string;
  faculty_id: string | null;
  department_id: string | null;
  role_name: RoleName;
}

const ROLE_LABEL: Record<string, string> = {
  university_admin: "Universitet admin",
  vice_rector: "Prorektor",
  science_department: "Ilmiy bo'lim",
  dean: "Dekan",
  staff_manager: "Kafedra mudiri",
  oquv_bolimi: "O'quv bo'limi",
  supervisor: "Ilmiy rahbar",
  doktorant: "Doktorant",
};

const ALL_ASSIGNABLE_ROLES: RoleName[] = [
  "university_admin",
  "vice_rector",
  "science_department",
  "dean",
  "staff_manager",
  "oquv_bolimi",
];

export default function UsersPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleName>("staff_manager");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Bulk import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResultOpen, setBulkResultOpen] = useState(false);
  type BulkRow = { row: number; display_name: string; email: string; status: "success" | "error"; error?: string };
  const [bulkResults, setBulkResults] = useState<BulkRow[]>([]);
  const [bulkSummary, setBulkSummary] = useState({ succeeded: 0, failed: 0 });

  const load = useCallback(async () => {
    if (!user?.university_id) return;
    setLoading(true);
    setError("");

    const [u, f, d] = await Promise.all([
      supabase
        .from("users")
        .select("id, display_name, email, role_id, faculty_id, department_id, roles!inner(name)")
        .eq("university_id", user.university_id),
      supabase.from("faculties").select("*").eq("university_id", user.university_id).order("short_code"),
      supabase.from("departments").select("*").eq("university_id", user.university_id).order("short_code"),
    ]);

    if (u.error) {
      setError(u.error.message);
    } else {
      setRows(
        ((u.data as any[]) ?? []).map((r) => ({
          id: r.id,
          display_name: r.display_name,
          email: r.email,
          role_id: r.role_id,
          faculty_id: r.faculty_id,
          department_id: r.department_id,
          role_name: r.roles.name,
        }))
      );
    }

    setFaculties((f.data as Faculty[]) ?? []);
    setDepartments((d.data as Department[]) ?? []);
    setLoading(false);
  }, [supabase, user?.university_id]);

  useEffect(() => {
    load();
  }, [load]);

  const facById = useMemo(() => new Map(faculties.map((x) => [x.id, x])), [faculties]);
  const depById = useMemo(() => new Map(departments.map((x) => [x.id, x])), [departments]);
  const departmentsForFaculty = useMemo(
    () => departments.filter((d) => d.faculty_id === facultyId),
    [departments, facultyId]
  );

  const openCreate = () => {
    setDisplayName("");
    setEmail("");
    setPassword("");
    setRole("staff_manager");
    setFacultyId("");
    setDepartmentId("");
    setFormError("");
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (password.length < 8) {
      setFormError("Parol kamida 8 ta belgidan iborat bo'lishi kerak.");
      return;
    }

    if (role === "dean" && !facultyId) {
      setFormError("Dekan uchun fakultet tanlang.");
      return;
    }

    if (role === "staff_manager" && !departmentId) {
      setFormError("Kafedrani tanlash majburiy.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password,
        display_name: displayName.trim(),
        role,
        faculty_id: facultyId || null,
        department_id: departmentId || null,
      }),
    });
    setSaving(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFormError(data?.error ?? `HTTP ${res.status}`);
      return;
    }

    setModalOpen(false);
    load();
  };

  const remove = async (r: Row) => {
    if (r.id === user?.id) {
      alert("O'zingizni o'chira olmaysiz.");
      return;
    }
    if (!confirm(`"${r.display_name}" foydalanuvchisini o'chirishni tasdiqlaysizmi?`)) return;

    const res = await fetch(`/api/users?id=${r.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error ?? `HTTP ${res.status}`);
      return;
    }

    load();
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setBulkUploading(true);
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/users/bulk", { method: "POST", body: fd });
    setBulkUploading(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error ?? `HTTP ${res.status}`);
      return;
    }

    setBulkResults(data.results ?? []);
    setBulkSummary({ succeeded: data.succeeded ?? 0, failed: data.failed ?? 0 });
    setBulkResultOpen(true);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Foydalanuvchilar</h1>
          <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
            Universitet xodimlari va ularning rollari
          </p>
        </div>
        {user?.role === "science_department" ? (
          <div className="flex items-center gap-2">
            <Link href="/doktorantura/create/doktorant">
              <Button>+ Doktorant</Button>
            </Link>
            <Link href="/doktorantura/create/supervisor">
              <Button variant="outline">+ Ilmiy rahbar</Button>
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <a href="/users-template.xlsx" download>
              <Button variant="outline" size="sm">Shablon yuklab olish</Button>
            </a>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleBulkUpload}
            />
            <Button
              variant="outline"
              size="sm"
              isLoading={bulkUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Excel yuklash
            </Button>
            <Button onClick={openCreate}>+ Yangi foydalanuvchi</Button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-600 dark:bg-danger-900/30 dark:text-danger-400">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-800">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-surface-500">Hali foydalanuvchi qo&apos;shilmagan.</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Ism</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Biriktirilgan</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-50 dark:hover:bg-surface-900/30">
                  <td className="px-4 py-3 text-sm">{r.display_name}</td>
                  <td className="px-4 py-3 font-mono text-sm text-surface-700 dark:text-surface-300">{r.email}</td>
                  <td className="px-4 py-3 text-sm">{ROLE_LABEL[r.role_name] ?? r.role_name}</td>
                  <td className="px-4 py-3 text-sm text-surface-500">
                    {r.department_id
                      ? `${facById.get(depById.get(r.department_id)?.faculty_id ?? "")?.short_code ?? "?"} / ${depById.get(r.department_id)?.short_code ?? "?"}`
                      : r.faculty_id
                        ? facById.get(r.faculty_id)?.short_code ?? "?"
                        : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="danger" size="sm" onClick={() => remove(r)}>
                      O&apos;chirish
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={bulkResultOpen} onClose={() => setBulkResultOpen(false)} title="Excel import natijalari">
        <div className="space-y-4">
          <div className="flex gap-4">
            <span className="rounded-full bg-success-100 px-3 py-1 text-sm font-medium text-success-700 dark:bg-success-900/30 dark:text-success-400">
              ✓ {bulkSummary.succeeded} ta muvaffaqiyatli
            </span>
            {bulkSummary.failed > 0 && (
              <span className="rounded-full bg-danger-100 px-3 py-1 text-sm font-medium text-danger-700 dark:bg-danger-900/30 dark:text-danger-400">
                ✗ {bulkSummary.failed} ta xato
              </span>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-surface-200 dark:border-surface-700">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-surface-600">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-surface-600">Ism</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-surface-600">Email</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-surface-600">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
                {bulkResults.map((r) => (
                  <tr key={r.row} className={r.status === "error" ? "bg-danger-50 dark:bg-danger-900/10" : ""}>
                    <td className="px-3 py-2 text-surface-500">{r.row}</td>
                    <td className="px-3 py-2">{r.display_name || "—"}</td>
                    <td className="px-3 py-2 font-mono text-surface-700 dark:text-surface-300">{r.email || "—"}</td>
                    <td className="px-3 py-2">
                      {r.status === "success" ? (
                        <span className="text-success-600 dark:text-success-400">✓ Qo&apos;shildi</span>
                      ) : (
                        <span className="text-danger-600 dark:text-danger-400">✗ {r.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setBulkResultOpen(false)}>Yopish</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Yangi foydalanuvchi">
        <form onSubmit={save} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600 dark:bg-danger-900/30 dark:text-danger-400">
              {formError}
            </div>
          )}
          <Input label="To'liq ism" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
          <Input
            label="Vaqtinchalik parol (kamida 8 ta belgi)"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700 dark:text-surface-300">Rol</label>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as RoleName);
                setFacultyId("");
                setDepartmentId("");
              }}
              className="w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-800"
            >
              {ALL_ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r] ?? r}
                </option>
              ))}
            </select>
          </div>

          {["dean", "staff_manager"].includes(role) && (
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700 dark:text-surface-300">Fakultet</label>
              <select
                value={facultyId}
                onChange={(e) => {
                  setFacultyId(e.target.value);
                  setDepartmentId("");
                }}
                className="w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-800"
                required
              >
                <option value="">- tanlang -</option>
                {faculties.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.short_code} - {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {role === "staff_manager" && facultyId && (
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700 dark:text-surface-300">Kafedra</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-600 dark:bg-surface-800"
                required
              >
                <option value="">- tanlang -</option>
                {departmentsForFaculty.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.short_code} - {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" isLoading={saving}>
              Yaratish
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
