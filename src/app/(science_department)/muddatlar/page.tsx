"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import type { Quarter, SubmissionDeadline, DeadlineScope } from "@/types/db";

interface StaffUser {
  id: string;
  display_name: string;
  email: string;
  department_name: string | null;
  faculty_name: string | null;
}

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

const QUARTER_LABELS: Record<Quarter, string> = {
  Q1: "I chorak",
  Q2: "II chorak",
  Q3: "III chorak",
  Q4: "IV chorak",
};

interface DeadlineWithUsers extends SubmissionDeadline {
  user_ids: string[];
}

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleString("uz-UZ", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function isPassed(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export default function MuddatlarPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  // --- List state ---
  const [deadlines, setDeadlines] = useState<DeadlineWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // --- Staff managers for 'specific' picker ---
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);

  // --- Form state ---
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formYear, setFormYear] = useState<number>(new Date().getFullYear());
  const [formQuarter, setFormQuarter] = useState<Quarter>("Q1");
  const [formDeadlineAt, setFormDeadlineAt] = useState("");
  const [formAppliesTo, setFormAppliesTo] = useState<DeadlineScope>("all");
  const [formSelectedUsers, setFormSelectedUsers] = useState<Set<string>>(new Set());
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // --- Deleting ---
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.university_id) return;
    setLoading(true);
    const { data, error: e } = await supabase
      .from("submission_deadlines")
      .select("*")
      .eq("university_id", user.university_id)
      .order("year", { ascending: false })
      .order("quarter", { ascending: false });

    if (e) { setError(e.message); setLoading(false); return; }

    const rows = (data as SubmissionDeadline[]) ?? [];

    // Fetch associated user_ids for 'specific' deadlines
    const specificIds = rows.filter((r) => r.applies_to === "specific").map((r) => r.id);
    let userMap: Record<string, string[]> = {};
    if (specificIds.length > 0) {
      const { data: du } = await supabase
        .from("submission_deadline_users")
        .select("deadline_id, user_id")
        .in("deadline_id", specificIds);
      (du ?? []).forEach((row: { deadline_id: string; user_id: string }) => {
        if (!userMap[row.deadline_id]) userMap[row.deadline_id] = [];
        userMap[row.deadline_id].push(row.user_id);
      });
    }

    setDeadlines(rows.map((r) => ({ ...r, user_ids: userMap[r.id] ?? [] })));
    setLoading(false);
  }, [user?.university_id, supabase]);

  const loadStaffUsers = useCallback(async () => {
    if (!user?.university_id) return;
    const { data: roleData } = await supabase
      .from("roles")
      .select("id")
      .eq("name", "staff_manager")
      .maybeSingle();
    if (!roleData) return;

    const { data: ud } = await supabase
      .from("users")
      .select("id, display_name, email, department_id, faculty_id")
      .eq("university_id", user.university_id)
      .eq("role_id", (roleData as { id: string }).id)
      .order("display_name");

    const rawUsers = (ud as Array<{
      id: string;
      display_name: string;
      email: string;
      department_id: string | null;
      faculty_id: string | null;
    }>) ?? [];

    // Batch-fetch department and faculty names
    const deptIds = [...new Set(rawUsers.map((u) => u.department_id).filter(Boolean))] as string[];
    const facIds  = [...new Set(rawUsers.map((u) => u.faculty_id).filter(Boolean))] as string[];

    const [deptRes, facRes] = await Promise.all([
      deptIds.length > 0
        ? supabase.from("departments").select("id, name").in("id", deptIds)
        : Promise.resolve({ data: [] }),
      facIds.length > 0
        ? supabase.from("faculties").select("id, name").in("id", facIds)
        : Promise.resolve({ data: [] }),
    ]);

    const deptMap = Object.fromEntries(
      ((deptRes.data ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name])
    );
    const facMap = Object.fromEntries(
      ((facRes.data ?? []) as { id: string; name: string }[]).map((f) => [f.id, f.name])
    );

    setStaffUsers(rawUsers.map((r) => ({
      id: r.id,
      display_name: r.display_name,
      email: r.email,
      department_name: r.department_id ? (deptMap[r.department_id] ?? null) : null,
      faculty_name: r.faculty_id ? (facMap[r.faculty_id] ?? null) : null,
    })));
  }, [user?.university_id, supabase]);

  useEffect(() => {
    void load();
    void loadStaffUsers();
  }, [load, loadStaffUsers]);

  const openNewForm = () => {
    setEditingId(null);
    setFormYear(new Date().getFullYear());
    setFormQuarter("Q1");
    setFormDeadlineAt("");
    setFormAppliesTo("all");
    setFormSelectedUsers(new Set());
    setFormIsActive(true);
    setUserSearch("");
    setError("");
    setMessage("");
    setShowForm(true);
  };

  const openEditForm = (d: DeadlineWithUsers) => {
    setEditingId(d.id);
    setFormYear(d.year);
    setFormQuarter(d.quarter);
    setFormDeadlineAt(toLocalDatetimeValue(d.deadline_at));
    setFormAppliesTo(d.applies_to);
    setFormSelectedUsers(new Set(d.user_ids));
    setFormIsActive(d.is_active);
    setUserSearch("");
    setError("");
    setMessage("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const toggleUser = (uid: string) => {
    setFormSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleSave = async () => {
    setError("");
    setMessage("");
    if (!formDeadlineAt) { setError("Muddat sanasi kiritilmagan."); return; }
    if (formAppliesTo === "specific" && formSelectedUsers.size === 0) {
      setError("\"Tanlangan mas'ullar\" rejimida kamida bitta mas'ul tanlang."); return;
    }
    if (!user?.university_id) return;
    setSaving(true);

    const deadlineIso = new Date(formDeadlineAt).toISOString();

    if (editingId) {
      // UPDATE
      const { error: e } = await supabase
        .from("submission_deadlines")
        .update({
          year: formYear,
          quarter: formQuarter,
          deadline_at: deadlineIso,
          applies_to: formAppliesTo,
          is_active: formIsActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);
      if (e) { setError(e.message); setSaving(false); return; }

      // Re-sync users
      await supabase.from("submission_deadline_users").delete().eq("deadline_id", editingId);
      if (formAppliesTo === "specific" && formSelectedUsers.size > 0) {
        await supabase.from("submission_deadline_users").insert(
          Array.from(formSelectedUsers).map((uid) => ({ deadline_id: editingId, user_id: uid }))
        );
      }
    } else {
      // INSERT
      const { data: inserted, error: e } = await supabase
        .from("submission_deadlines")
        .insert({
          university_id: user.university_id,
          year: formYear,
          quarter: formQuarter,
          deadline_at: deadlineIso,
          applies_to: formAppliesTo,
          is_active: formIsActive,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (e || !inserted) { setError(e?.message ?? "Xatolik"); setSaving(false); return; }

      if (formAppliesTo === "specific" && formSelectedUsers.size > 0) {
        await supabase.from("submission_deadline_users").insert(
          Array.from(formSelectedUsers).map((uid) => ({ deadline_id: (inserted as { id: string }).id, user_id: uid }))
        );
      }
    }

    setSaving(false);
    setMessage(editingId ? "Muddat yangilandi." : "Muddat saqlandi.");
    closeForm();
    void load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu muddatni o'chirishni tasdiqlaysizmi?")) return;
    setDeletingId(id);
    const { error: e } = await supabase.from("submission_deadlines").delete().eq("id", id);
    setDeletingId(null);
    if (e) { setError(e.message); return; }
    setMessage("Muddat o'chirildi.");
    void load();
  };

  const handleToggleActive = async (d: DeadlineWithUsers) => {
    const { error: e } = await supabase
      .from("submission_deadlines")
      .update({ is_active: !d.is_active, updated_at: new Date().toISOString() })
      .eq("id", d.id);
    if (e) { setError(e.message); return; }
    void load();
  };

  const staffInfoMap = Object.fromEntries(
    staffUsers.map((u) => [u.id, { name: u.display_name, dept: u.department_name }])
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Hisobot muddatlari</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Kafedra mas'ullari uchun hisobot yuborish muddatlarini belgilang
          </p>
        </div>
        {!showForm && (
          <Button onClick={openNewForm}>+ Muddat qo&apos;shish</Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">
          {error}
        </div>
      )}
      {message && !showForm && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm">
          {message}
        </div>
      )}

      {/* ── Form ─────────────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="mb-6 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-5">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
            {editingId ? "Muddatni tahrirlash" : "Yangi muddat"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Yil</label>
              <input
                type="number"
                value={formYear}
                min={2020} max={2100}
                onChange={(e) => setFormYear(Number(e.target.value))}
                className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Chorak</label>
              <select
                value={formQuarter}
                onChange={(e) => setFormQuarter(e.target.value as Quarter)}
                className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
              >
                {QUARTERS.map((q) => (
                  <option key={q} value={q}>{QUARTER_LABELS[q]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                Muddat tugash sanasi va vaqti
              </label>
              <input
                type="datetime-local"
                value={formDeadlineAt}
                onChange={(e) => setFormDeadlineAt(e.target.value)}
                className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Qamrov */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-2">Qamrov</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-surface-700 dark:text-surface-300">
                <input
                  type="radio"
                  name="appliesTo"
                  value="all"
                  checked={formAppliesTo === "all"}
                  onChange={() => setFormAppliesTo("all")}
                  className="accent-primary-600"
                />
                Barcha kafedra mas&apos;ullari
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-surface-700 dark:text-surface-300">
                <input
                  type="radio"
                  name="appliesTo"
                  value="specific"
                  checked={formAppliesTo === "specific"}
                  onChange={() => setFormAppliesTo("specific")}
                  className="accent-primary-600"
                />
                Tanlangan mas&apos;ullar
              </label>
            </div>
          </div>

          {/* Specific users picker */}
          {formAppliesTo === "specific" && (
            <div className="mb-4 border border-surface-200 dark:border-surface-600 rounded-lg overflow-hidden">
              <div className="bg-surface-50 dark:bg-surface-900/50 px-3 py-2 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase shrink-0">
                  Mas&apos;ullar ro&apos;yxati ({formSelectedUsers.size} ta tanlangan)
                </span>
              </div>
              {/* Search bar */}
              <div className="px-3 py-2 border-b border-surface-200 dark:border-surface-600">
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Ism yoki kafedra bo'yicha qidirish..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 placeholder-surface-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  {userSearch && (
                    <button
                      type="button"
                      onClick={() => setUserSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              {staffUsers.length === 0 ? (
                <div className="px-3 py-4 text-sm text-surface-400 text-center">
                  Kafedra mas&apos;ullari topilmadi
                </div>
              ) : (() => {
                const q = userSearch.trim().toLowerCase();
                const filtered = q
                  ? staffUsers.filter(
                      (u) =>
                        u.display_name.toLowerCase().includes(q) ||
                        (u.department_name ?? "").toLowerCase().includes(q) ||
                        (u.faculty_name ?? "").toLowerCase().includes(q) ||
                        u.email.toLowerCase().includes(q)
                    )
                  : staffUsers;
                return filtered.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-surface-400 text-center">
                    &quot;{userSearch}&quot; bo&apos;yicha topilmadi
                  </div>
                ) : (
                  <div className="max-h-52 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-700">
                    {filtered.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-700/30 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formSelectedUsers.has(u.id)}
                          onChange={() => toggleUser(u.id)}
                          className="accent-primary-600 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-surface-900 dark:text-surface-100">{u.display_name}</div>
                          {(u.department_name || u.faculty_name) && (
                            <div className="text-xs text-primary-600 dark:text-primary-400 truncate">
                              {u.department_name ?? u.faculty_name}
                            </div>
                          )}
                          <div className="text-xs text-surface-400 truncate">{u.email}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Is active */}
          <div className="mb-5">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-surface-700 dark:text-surface-300">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="accent-primary-600"
              />
              Muddat faol (yoqilgan)
            </label>
          </div>

          {error && (
            <div className="mb-3 p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={closeForm}>Bekor qilish</Button>
            <Button onClick={handleSave} isLoading={saving}>
              {editingId ? "Saqlash" : "Qo'shish"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Deadlines list ───────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
        ) : deadlines.length === 0 ? (
          <div className="p-8 text-center text-surface-500">Hali muddat belgilanmagan.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Davr</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Muddat</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Qamrov</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Holat</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-surface-600 uppercase">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {deadlines.map((d) => {
                const passed = isPassed(d.deadline_at);
                const active = d.is_active;
                return (
                  <tr key={d.id} className="align-middle">
                    <td className="px-4 py-3 text-sm font-medium text-surface-900 dark:text-surface-100">
                      {d.year} — {QUARTER_LABELS[d.quarter]}
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-700 dark:text-surface-300">
                      {formatDeadline(d.deadline_at)}
                      {active && passed && (
                        <span className="ml-2 text-xs font-medium text-danger-600 dark:text-danger-400">(o&apos;tgan)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-700 dark:text-surface-300">
                      {d.applies_to === "all" ? (
                        <span>Barcha mas&apos;ullar</span>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="text-primary-600 dark:text-primary-400 text-xs font-medium">
                            {d.user_ids.length} ta mas&apos;ul
                          </span>
                          {d.user_ids.slice(0, 4).map((uid) => {
                            const info = staffInfoMap[uid];
                            return (
                              <div key={uid} className="text-xs text-surface-600 dark:text-surface-300">
                                {info?.name ?? uid}
                                {info?.dept && (
                                  <span className="text-surface-400 ml-1">({info.dept})</span>
                                )}
                              </div>
                            );
                          })}
                          {d.user_ids.length > 4 && (
                            <div className="text-xs text-surface-400">+{d.user_ids.length - 4} ta</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(d)}
                        title={active ? "O'chirish" : "Yoqish"}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          active
                            ? passed
                              ? "bg-danger-100 dark:bg-danger-900/40 text-danger-700 dark:text-danger-300"
                              : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                            : "bg-surface-100 dark:bg-surface-700 text-surface-500"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          active ? (passed ? "bg-danger-500" : "bg-green-500") : "bg-surface-400"
                        }`} />
                        {active ? (passed ? "O'tgan" : "Faol") : "O'chirilgan"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditForm(d)}
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          Tahrirlash
                        </button>
                        <button
                          onClick={() => handleDelete(d.id)}
                          disabled={deletingId === d.id}
                          className="text-xs text-danger-600 dark:text-danger-400 hover:underline disabled:opacity-50"
                        >
                          {deletingId === d.id ? "..." : "O'chirish"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
