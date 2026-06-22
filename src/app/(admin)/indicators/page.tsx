"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { Indicator, IndicatorCalculationConfig, IndicatorSubmission, Quarter } from "@/types/db";
import { isPercentageCalculationConfig } from "@/lib/indicator-calculation";
import {
  DEFAULT_SUBMISSION_FILE_EXTENSIONS,
  SUBMISSION_FILE_FORMATS,
} from "@/lib/upload-validation";
import { QUARTER_LABELS } from "@/lib/constants";

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];
const CAN_DOWNLOAD_ROLES = ["university_admin", "vice_rector", "science_department", "super_admin"];

export default function IndicatorsPage() {
  const supabase = createClient();
  const { user } = useSupabaseAuth();
  const [rows, setRows] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reordering, setReordering] = useState(false);

  const canDownload = !!user?.role && CAN_DOWNLOAD_ROLES.includes(user.role);
  const [fileYear, setFileYear] = useState<number>(new Date().getFullYear());
  const [fileQuarter, setFileQuarter] = useState<Quarter | "">("");
  const [fileCounts, setFileCounts] = useState<Map<string, number>>(new Map());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Indicator | null>(null);
  const [no, setNo] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");
  const [isSub, setIsSub] = useState(false);
  const [parentId, setParentId] = useState<string>("");
  const [minPages, setMinPages] = useState("");
  const [maxPages, setMaxPages] = useState("");
  const [minFiles, setMinFiles] = useState("0");
  const [usePercentageCalculation, setUsePercentageCalculation] = useState(false);
  const [denominatorLabel, setDenominatorLabel] = useState("");
  const [numeratorLabels, setNumeratorLabels] = useState<string[]>([""]);
  const [allowedFileExtensions, setAllowedFileExtensions] = useState<string[]>(
    DEFAULT_SUBMISSION_FILE_EXTENSIONS
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // drag state
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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

  useEffect(() => { load(); }, [load]);

  const loadFileCounts = useCallback(async () => {
    if (!user?.university_id || !canDownload) return;
    let q = supabase
      .from("submissions")
      .select("indicators")
      .eq("university_id", user.university_id)
      .eq("year", fileYear);
    if (fileQuarter) q = q.eq("quarter", fileQuarter);
    const { data } = await q;
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const indicators = (row.indicators ?? {}) as Record<string, IndicatorSubmission>;
      for (const [indicatorId, entry] of Object.entries(indicators)) {
        const fileCount = entry?.files?.length ?? 0;
        if (fileCount > 0) counts.set(indicatorId, (counts.get(indicatorId) ?? 0) + fileCount);
      }
    }
    setFileCounts(counts);
  }, [supabase, user?.university_id, canDownload, fileYear, fileQuarter]);

  useEffect(() => { loadFileCounts(); }, [loadFileCounts]);

  const downloadAll = async (indicator: Indicator) => {
    setDownloadingId(indicator.id);
    setDownloadProgress(0);
    try {
      const params = new URLSearchParams({ year: String(fileYear) });
      if (fileQuarter) params.set("quarter", fileQuarter);
      const res = await fetch(`/api/indicators/${indicator.id}/signed-urls?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Fayllarni yuklab bo'lmadi.");
        return;
      }
      const { folderName, zipName, files } = (await res.json()) as {
        folderName: string;
        zipName: string;
        files: { url: string; name: string }[];
      };

      // Stream the ZIP straight to disk: files are fetched one at a time and piped
      // into the archive as bytes arrive, so neither the server nor the browser
      // ever holds all files in memory. Handles thousands of files / many GB.
      const [{ downloadZip }, streamSaverMod] = await Promise.all([
        import("client-zip"),
        import("streamsaver"),
      ]);
      const streamSaver = streamSaverMod.default;
      streamSaver.mitm = "/streamsaver/mitm.html";

      let done = 0;
      async function* lazyFiles() {
        // ponytail: sequential fetch — memory-safe; if too slow, prefetch a small
        // window (e.g. 4 ahead) concurrently.
        for (const f of files) {
          const fileRes = await fetch(f.url);
          done += 1;
          setDownloadProgress(Math.round((done / files.length) * 100));
          yield { name: `${folderName}/${f.name}`, input: fileRes };
        }
      }

      const fileStream = streamSaver.createWriteStream(zipName);
      const zipBody = downloadZip(lazyFiles()).body;
      if (!zipBody) throw new Error("ZIP oqimini yaratib bo'lmadi.");
      await zipBody.pipeTo(fileStream);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Yuklab olishda xatolik.");
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
    }
  };

  // parent indicators = non-sub indicators that other rows can be grouped under
  const parentOptions = rows.filter((r) => !r.is_sub_indicator);

  const makeFieldKey = (label: string, index: number) => {
    const base = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return base ? `${base}_${index + 1}` : `field_${index + 1}`;
  };

  const normalizeCalculationConfig = (): IndicatorCalculationConfig | null => {
    if (!usePercentageCalculation) return null;
    const denominator = denominatorLabel.trim();
    const numerators = numeratorLabels.map((label) => label.trim()).filter(Boolean);
    if (!denominator || numerators.length === 0) return null;
    return {
      type: "percentage",
      denominator: { key: "denominator", label: denominator },
      numerators: numerators.map((label, index) => ({
        key: makeFieldKey(label, index),
        label,
      })),
    };
  };

  // ── Drag-and-drop ──────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragIdx.current === null || dragIdx.current === idx) return;
    setDragOverIdx(idx);
    const next = [...rows];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(idx, 0, moved);
    dragIdx.current = idx;
    setRows(next);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIdx(null);
    dragIdx.current = null;
    setReordering(true);
    await Promise.all(
      rows.map((r, i) =>
        supabase.from("indicators").update({ order_idx: i + 1 }).eq("id", r.id)
      )
    );
    setReordering(false);
  };

  const handleDragEnd = () => {
    setDragOverIdx(null);
    dragIdx.current = null;
  };

  // ── CRUD ──────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setNo("");
    setName("");
    setDescription("");
    setUnit("");
    setIsSub(false);
    setParentId("");
    setMinPages("");
    setMaxPages("");
    setMinFiles("0");
    setUsePercentageCalculation(false);
    setDenominatorLabel("");
    setNumeratorLabels([""]);
    setAllowedFileExtensions(DEFAULT_SUBMISSION_FILE_EXTENSIONS);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (i: Indicator) => {
    setEditing(i);
    setNo(i.no);
    setName(i.name);
    setDescription(i.description ?? "");
    setUnit(i.unit);
    setIsSub(i.is_sub_indicator);
    setParentId(i.parent_id ?? "");
    setMinPages(i.min_pages !== null ? String(i.min_pages) : "");
    setMaxPages(i.max_pages !== null ? String(i.max_pages) : "");
    setMinFiles(String(i.min_files ?? 0));
    const calculationConfig = isPercentageCalculationConfig(i.calculation_config)
      ? i.calculation_config
      : null;
    setUsePercentageCalculation(!!calculationConfig);
    setDenominatorLabel(calculationConfig?.denominator.label ?? "");
    setNumeratorLabels(
      calculationConfig?.numerators.length
        ? calculationConfig.numerators.map((field) => field.label)
        : [""]
    );
    setAllowedFileExtensions(
      i.allowed_file_extensions?.length
        ? i.allowed_file_extensions
        : DEFAULT_SUBMISSION_FILE_EXTENSIONS
    );
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
    if (isSub && !parentId) {
      setFormError("Sub-ko'rsatkich uchun asosiy ko'rsatkichni tanlang.");
      return;
    }
    if (allowedFileExtensions.length === 0) {
      setFormError("Kamida bitta fayl formatini tanlang.");
      return;
    }
    const parsedMinFiles = minFiles.trim() !== "" ? parseInt(minFiles, 10) : 0;
    if (isNaN(parsedMinFiles) || parsedMinFiles < 0) {
      setFormError("Eng kam fayllar soni 0 yoki undan katta son bo'lishi kerak.");
      return;
    }
    if (usePercentageCalculation) {
      if (!denominatorLabel.trim()) {
        setFormError("Foiz hisoblash uchun asosiy maydon labelini kiriting.");
        return;
      }
      if (numeratorLabels.map((label) => label.trim()).filter(Boolean).length === 0) {
        setFormError("Foiz hisoblash uchun kamida bitta qo'shiladigan maydon kiriting.");
        return;
      }
    }
    setSaving(true);
    const orderIdx = editing
      ? editing.order_idx
      : rows.length > 0 ? Math.max(...rows.map((r) => r.order_idx)) + 1 : 1;

    const parsedMin = minPages.trim() !== "" ? parseInt(minPages, 10) : null;
    const parsedMax = maxPages.trim() !== "" ? parseInt(maxPages, 10) : null;
    if (parsedMin !== null && (isNaN(parsedMin) || parsedMin < 1)) {
      setFormError("Eng kam bet 1 yoki undan katta son bo'lishi kerak.");
      setSaving(false);
      return;
    }
    if (parsedMax !== null && (isNaN(parsedMax) || parsedMax < 1)) {
      setFormError("Eng ko'p bet 1 yoki undan katta son bo'lishi kerak.");
      setSaving(false);
      return;
    }
    if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
      setFormError("Eng kam bet eng ko'p betdan katta bo'lmasligi kerak.");
      setSaving(false);
      return;
    }

    const payload = {
      no: no.trim(),
      name: name.trim(),
      description: description.trim() || null,
      unit: unit.trim(),
      order_idx: orderIdx,
      is_sub_indicator: isSub,
      parent_id: isSub ? parentId : null,
      university_id: user.university_id,
      min_pages: parsedMin,
      max_pages: parsedMax,
      min_files: parsedMinFiles,
      allowed_file_extensions: allowedFileExtensions,
      calculation_config: normalizeCalculationConfig(),
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

  // which indicator ids are parents (have at least one child)
  const parentIds = new Set(rows.map((r) => r.parent_id).filter(Boolean));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Ko&apos;rsatkichlar</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            KPI ko&apos;rsatkichlarini boshqarish
            {reordering && <span className="ml-2 text-primary-500">Tartib saqlanmoqda...</span>}
          </p>
        </div>
        <Button onClick={openCreate}>+ Yangi ko&apos;rsatkich</Button>
      </div>

      {canDownload && (
        <div className="mb-4 flex items-end gap-3 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-3">
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Yil</label>
            <input
              type="number"
              value={fileYear}
              onChange={(e) => setFileYear(Number(e.target.value))}
              className="w-24 rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Chorak</label>
            <select
              value={fileQuarter}
              onChange={(e) => setFileQuarter(e.target.value as Quarter | "")}
              className="rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
            >
              <option value="">Barchasi</option>
              {QUARTERS.map((q) => <option key={q} value={q}>{QUARTER_LABELS[q]}</option>)}
            </select>
          </div>
          <p className="text-xs text-surface-400 pb-2">Fayllar soni va yuklab olish shu davr bo&apos;yicha hisoblanadi</p>
        </div>
      )}

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
                <th className="px-3 py-3 w-10" title="Tartibni o'zgartirish uchun sudrang" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-16">№</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-24">Birlik</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-28">Turi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-52">Fayl formatlari</th>
                {canDownload && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-600 uppercase w-44">Yuklangan fayllar</th>
                )}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {rows.map((ind, idx) => {
                const isParent = parentIds.has(ind.id);
                const parentLabel = ind.parent_id
                  ? rows.find((r) => r.id === ind.parent_id)?.no
                  : null;

                return (
                  <tr
                    key={ind.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    className={`transition-colors ${
                      dragOverIdx === idx
                        ? "bg-primary-50 dark:bg-primary-900/20"
                        : isParent
                        ? "bg-surface-50/70 dark:bg-surface-900/40 hover:bg-surface-100/70 dark:hover:bg-surface-900/60"
                        : "hover:bg-surface-50 dark:hover:bg-surface-900/30"
                    }`}
                  >
                    <td className="px-3 py-3 cursor-grab active:cursor-grabbing text-center">
                      <svg className="w-4 h-4 text-surface-400 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm8 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM8 13.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm8 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM8 21a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm8 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
                      </svg>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono font-semibold">{ind.no}</td>
                    <td className={`px-4 py-3 text-sm ${ind.is_sub_indicator ? "pl-10 text-surface-600 dark:text-surface-400" : "font-medium"}`}>
                      {ind.is_sub_indicator && (
                        <span className="mr-1 text-surface-400">↳</span>
                      )}
                      {ind.name}
                      {isParent && (
                        <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                          YIG&apos;INDI
                        </span>
                      )}
                      {ind.description && (
                        <div className="mt-2 rounded-md border border-blue-100 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-900/10 px-3 py-2 text-xs font-normal leading-relaxed text-blue-800 dark:text-blue-200">
                          <span className="font-semibold">Izoh:</span> {ind.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-500">{ind.unit}</td>
                    <td className="px-4 py-3 text-xs text-surface-500">
                      <div className="flex flex-col gap-1">
                        {isParent ? (
                          <span className="text-primary-600 dark:text-primary-400 font-medium">Asosiy</span>
                        ) : ind.is_sub_indicator ? (
                          <span className="text-surface-400">
                            Sub {parentLabel ? `(${parentLabel})` : ""}
                          </span>
                        ) : (
                          <span className="text-surface-400">Oddiy</span>
                        )}
                        {isPercentageCalculationConfig(ind.calculation_config) && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] font-medium">
                            FOIZ FORMULA
                          </span>
                        )}
                        {(ind.min_files ?? 0) > 0 && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-[10px] font-medium">
                            Kamida {ind.min_files} fayl
                          </span>
                        )}
                        {(ind.min_pages !== null || ind.max_pages !== null) && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-medium">
                            PDF: {ind.min_pages ?? 1}–{ind.max_pages ?? "∞"} bet
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-surface-500">
                      <div className="flex flex-wrap gap-1">
                        {(ind.allowed_file_extensions?.length
                          ? ind.allowed_file_extensions
                          : DEFAULT_SUBMISSION_FILE_EXTENSIONS
                        ).map((extension) => (
                          <span
                            key={extension}
                            className="rounded bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 font-mono text-[10px]"
                          >
                            .{extension}
                          </span>
                        ))}
                      </div>
                    </td>
                    {canDownload && (
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-surface-500">{fileCounts.get(ind.id) ?? 0} ta</span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!fileCounts.get(ind.id) || downloadingId === ind.id}
                            isLoading={downloadingId === ind.id}
                            onClick={() => downloadAll(ind)}
                          >
                            {downloadingId === ind.id ? `${downloadProgress}%` : "Yuklab olish"}
                          </Button>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(ind)}>Tahrirlash</Button>
                      <Button variant="danger" size="sm" onClick={() => remove(ind)}>O&apos;chirish</Button>
                    </td>
                  </tr>
                );
              })}
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
            <Input label="Birlik" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%, nafar, dona" required />
          </div>
          <Input label="Nomi" value={name} onChange={(e) => setName(e.target.value)} required />

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Izoh
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Indikator uchun qo'shimcha tushuntirish..."
              className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="rounded-lg border border-surface-200 dark:border-surface-700 p-3 space-y-3">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={usePercentageCalculation}
                onChange={(e) => setUsePercentageCalculation(e.target.checked)}
              />
              <span>
                <span className="font-medium text-surface-700 dark:text-surface-300">
                  Amal qiymatini foiz formulasi orqali hisoblash
                </span>
                <span className="block text-xs text-surface-400 mt-0.5">
                  Yoqilsa, xodim Amal qiymatini qo'lda kirita olmaydi; qiymat quyidagi maydonlardan hisoblanadi.
                </span>
              </span>
            </label>

            {usePercentageCalculation && (
              <div className="space-y-3 border-t border-surface-200 dark:border-surface-700 pt-3">
                <Input
                  label="Asosiy maydon labeli"
                  value={denominatorLabel}
                  onChange={(e) => setDenominatorLabel(e.target.value)}
                  placeholder="Masalan: Asosiy shtatdagi o'qituvchilar soni"
                  required={usePercentageCalculation}
                />
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Foizga qo'shiladigan maydonlar
                  </label>
                  <div className="space-y-2">
                    {numeratorLabels.map((label, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          value={label}
                          onChange={(e) =>
                            setNumeratorLabels((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? e.target.value : item
                              )
                            )
                          }
                          placeholder={index === 0 ? "Masalan: shundan DSc lar soni" : "Maydon labeli"}
                          className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setNumeratorLabels((current) =>
                              current.length === 1 ? [""] : current.filter((_, itemIndex) => itemIndex !== index)
                            )
                          }
                        >
                          O'chirish
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setNumeratorLabels((current) => [...current, ""])}
                  >
                    + Maydon qo'shish
                  </Button>
                </div>
                <div className="rounded-md bg-surface-50 dark:bg-surface-900/50 px-3 py-2 text-xs text-surface-500 dark:text-surface-400">
                  Formula: (qo'shiladigan maydonlar yig'indisi) / asosiy maydon * 100
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2">
              <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Ruxsat etilgan fayl formatlari
              </span>
              <p className="mt-0.5 text-xs text-surface-400">
                Xodim faqat tanlangan formatlarni yuklay oladi. Maksimal hajm: 10 MB.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-md border border-surface-200 dark:border-surface-700 p-3">
              {SUBMISSION_FILE_FORMATS.map((format) => (
                <label
                  key={format.extension}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={allowedFileExtensions.includes(format.extension)}
                    onChange={(e) => {
                      setAllowedFileExtensions((current) =>
                        e.target.checked
                          ? [...current, format.extension]
                          : current.filter((extension) => extension !== format.extension)
                      );
                    }}
                  />
                  <span>{format.label}</span>
                  <span className="text-xs text-surface-400">.{format.extension}</span>
                </label>
              ))}
            </div>
          </div>

          <Input
            label="Eng kam yuklanishi kerak bo'lgan fayllar soni"
            type="number"
            min={0}
            value={minFiles}
            onChange={(e) => setMinFiles(e.target.value)}
            placeholder="0"
          />

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-surface-700 dark:text-surface-300">PDF sahifa chegarasi</span>
              <span className="text-xs text-surface-400">(ixtiyoriy — faqat PDF fayllarga taalluqli)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Eng kam bet"
                type="number"
                min={1}
                value={minPages}
                onChange={(e) => setMinPages(e.target.value)}
                placeholder="Bo'sh = cheksiz"
              />
              <Input
                label="Eng ko'p bet"
                type="number"
                min={1}
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value)}
                placeholder="Bo'sh = cheksiz"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isSub}
              onChange={(e) => {
                setIsSub(e.target.checked);
                if (!e.target.checked) setParentId("");
              }}
            />
            Bu sub-ko&apos;rsatkich
          </label>

          {isSub && (
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Asosiy ko&apos;rsatkich <span className="text-danger-500">*</span>
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">— Tanlang —</option>
                {parentOptions
                  .filter((p) => !editing || p.id !== editing.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.no}. {p.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button type="submit" isLoading={saving}>{editing ? "Saqlash" : "Yaratish"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
