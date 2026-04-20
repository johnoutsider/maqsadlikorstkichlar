"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { Indicator } from "@/types/db";

export default function IndicatorsPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const [rows, setRows] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Indicator | null>(null);
  const [no, setNo] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [orderIdx, setOrderIdx] = useState<number>(0);
  const [isSub, setIsSub] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    if (!user?.university_id) return;
    setLoading(true);
    const { data, error: e } = await supabase
      .from("indicators")
      .select("*")
      .eq("university_id", user.university_id)
      .order("order_idx");
    if (e) setError(e.message);
    else setRows((data as Indicator[]) ?? []);
    setLoading(false);
  }, [supabase, user?.university_id]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setNo("");
    setName("");
    setUnit("");
    setOrderIdx(rows.length > 0 ? Math.max(...rows.map((r) => r.order_idx)) + 1 : 1);
    setIsSub(false);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (i: Indicator) => {
    setEditing(i);
    setNo(i.no);
    setName(i.name);
    setUnit(i.unit);
    setOrderIdx(i.order_idx);
    setIsSub(i.is_sub_indicator);
    setFormError("");
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!user?.university_id) return;
    if (!no.trim() || !name.trim() || !unit.trim()) {
      setFormError("Barcha maydonlar talab qilinadi.");
      return;
    }
    setSaving(true);
    const payload = {
      no: no.trim(),
      name: name.trim(),
      unit: unit.trim(),
      order_idx: orderIdx,
      is_sub_indicator: isSub,
      university_id: user.university_id,
    };
    const { error: e2 } = editing
      ? await supabase.from("indicators").update(payload).eq("id", editing.id)
      : await supabase.from("indicators").insert(payload);
    setSaving(false);
    if (e2) {
      setFormError(e2.code === "23505" ? "Bu raqam allaqachon mavjud." : e2.message);
      return;
    }
    setModalOpen(false);
    load();
  };

  const remove = async (i: Indicator) => {
    if (!confirm(`"${i.no}. ${i.name}" ko'rsatkichini o'chirishni tasdiqlaysizmi?`)) return;
    const { error: e } = await supabase.from("indicators").delete().eq("id", i.id);
    if (e) { alert(e.message); return; }
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Ko&apos;rsatkichlar</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">KPI ko&apos;rsatkichlarini boshqarish</p>
        </div>
        <Button onClick={openCreate}>+ Yangi ko&apos;rsatkich</Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Yuklanmoqda...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-surface-500">Hali ko&apos;rsatkich qo&apos;shilmagan.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-16">№</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-24">Birlik</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-20">Tartib</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-20">Sub</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {rows.map((i) => (
                <tr key={i.id} className="hover:bg-surface-50 dark:hover:bg-surface-900/30">
                  <td className="px-4 py-3 text-sm font-mono">{i.no}</td>
                  <td className={`px-4 py-3 text-sm ${i.is_sub_indicator ? "pl-8 text-surface-600" : ""}`}>{i.name}</td>
                  <td className="px-4 py-3 text-sm text-surface-500">{i.unit}</td>
                  <td className="px-4 py-3 text-sm text-surface-500">{i.order_idx}</td>
                  <td className="px-4 py-3 text-sm">{i.is_sub_indicator ? "✓" : ""}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(i)}>Tahrirlash</Button>
                    <Button variant="danger" size="sm" onClick={() => remove(i)}>O&apos;chirish</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Ko'rsatkichni tahrirlash" : "Yangi ko'rsatkich"}>
        <form onSubmit={save} className="space-y-4">
          {formError && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg text-sm">{formError}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Raqam (№)" value={no} onChange={(e) => setNo(e.target.value)} placeholder="1 yoki 12a" required />
            <Input label="Tartib" type="number" value={orderIdx} onChange={(e) => setOrderIdx(Number(e.target.value))} required />
          </div>
          <Input label="Nomi" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Birlik" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%, nafar, dona, mln. so'm" required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isSub} onChange={(e) => setIsSub(e.target.checked)} />
            Bu sub-ko&apos;rsatkich
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button type="submit" isLoading={saving}>{editing ? "Saqlash" : "Yaratish"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
