"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

export default function HolatYangilashPage() {
  const [doktorantlar, setDoktorantlar] = useState<any[]>([]);
  const [selectedDoktorant, setSelectedDoktorant] = useState<string>("");
  const [currentStatus, setCurrentStatus] = useState<string>("");
  const [newStatus, setNewStatus] = useState<string>("");
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  useEffect(() => {
    async function fetchDocs() {
      if (!user) return;

      const { data: sup } = await supabase
        .from("supervisors")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!sup) return;

      const { data } = await supabase
        .from("doktorantlar")
        .select("id, full_name, student_id, thesis_status")
        .eq("supervisor_id", sup.id);
      
      if (data) setDoktorantlar(data);
      setLoading(false);
    }
    fetchDocs();
  }, [supabase]);

  useEffect(() => {
    if (selectedDoktorant) {
      const doc = doktorantlar.find(d => d.id === selectedDoktorant);
      if (doc) {
        setCurrentStatus(doc.thesis_status);
        setNewStatus(doc.thesis_status);
      }
    } else {
      setCurrentStatus("");
      setNewStatus("");
    }
  }, [selectedDoktorant, doktorantlar]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    if (newStatus === currentStatus) {
      setError("Holat o'zgarmadi");
      setSubmitting(false);
      return;
    }

    const { error: updateErr } = await supabase
      .from("doktorantlar")
      .update({ thesis_status: newStatus })
      .eq("id", selectedDoktorant);

    if (updateErr) {
      setError(updateErr.message);
    } else {
      router.push("/doktorantura/mening-talabalarim");
    }
    setSubmitting(false);
  };

  const thesisStatusMap: Record<string, string> = {
    taklif: "Taklif",
    jarayonda: "Jarayonda",
    korib_chiqilmoqda: "Ko'rib chiqilmoqda",
    himoyalangan: "Himoyalangan",
    yakunlangan: "Yakunlangan"
  };

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display text-(--on-surface)">Dissertatsiya Holatini Yangilash</h1>
      </div>

      {error && <div className="p-4 bg-red-100 text-red-800 rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6 bg-(--surface-container-lowest) p-6 rounded-2xl border border-(--outline-variant)">
        <div>
          <label className="block text-sm font-medium mb-1 text-(--on-surface-variant)">Doktorantni tanlang</label>
          <select 
            className="w-full bg-(--surface) border border-(--outline) rounded-lg p-2 outline-none"
            value={selectedDoktorant}
            onChange={e => setSelectedDoktorant(e.target.value)}
            required
          >
            <option value="">-- Tanlang --</option>
            {doktorantlar.map(d => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
        </div>

        {selectedDoktorant && (
          <>
            <div className="p-4 rounded-xl bg-(--surface-container) border border-(--outline-variant)">
              <p className="text-xs text-(--on-surface-variant) uppercase tracking-wider font-semibold mb-1">JONLI HOLAT</p>
              <p className="font-medium text-(--on-surface)">{thesisStatusMap[currentStatus] || currentStatus}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-(--on-surface-variant)">Yangi Holat</label>
              <select 
                className="w-full bg-(--surface) border border-(--outline) rounded-lg p-2 outline-none"
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
                required
              >
                {Object.entries(thesisStatusMap).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" variant="primary" isLoading={submitting}>Saqlash</Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
