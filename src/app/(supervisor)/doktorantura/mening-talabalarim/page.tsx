"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import type { DoktorantMetadata } from "@/lib/doktorant-profile";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

type DoktorantCard = {
  id: string;
  full_name: string;
  student_id: string;
  enrollment_year: number;
  thesis_status: string;
  research_topic: string;
  metadata?: DoktorantMetadata | null;
};

export default function MyStudentsPage() {
  const [doktorantlar, setDoktorantlar] = useState<DoktorantCard[]>([]);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { user } = useSupabaseAuth();

  useEffect(() => {
    async function fetchDocs() {
      setLoading(true);

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: sup } = await supabase
        .from("supervisors")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!sup) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("doktorantlar")
        .select(`
          id,
          full_name,
          student_id,
          enrollment_year,
          thesis_status,
          research_topic,
          metadata
        `)
        .eq("supervisor_id", sup.id);

      const doktorantList = (data ?? []) as DoktorantCard[];
      setDoktorantlar(doktorantList);

      const signedEntries = await Promise.all(
        doktorantList.map(async (doktorant) => {
          const avatarPath = doktorant.metadata?.avatar_path;
          if (!avatarPath) {
            return [doktorant.id, ""] as const;
          }

          const { data: signedAvatar } = await supabase.storage
            .from("doktorant-avatars")
            .createSignedUrl(avatarPath, 60 * 60);

          return [doktorant.id, signedAvatar?.signedUrl ?? ""] as const;
        })
      );

      setAvatarUrls(Object.fromEntries(signedEntries));
      setLoading(false);
    }

    fetchDocs();
  }, [supabase, user]);

  const thesisStatusMap: Record<string, string> = {
    taklif: "Taklif",
    jarayonda: "Jarayonda",
    korib_chiqilmoqda: "Ko'rib chiqilmoqda",
    himoyalangan: "Himoyalangan",
    yakunlangan: "Yakunlangan",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-(--on-surface)">Mening Doktorantlarim</h1>
        <p className="mt-1 text-sm text-(--on-surface-variant)">Sizga biriktirilgan doktorantlar ro&apos;yxati</p>
      </div>

      <div className="rounded-2xl border border-(--outline-variant) bg-(--surface-container-lowest) p-6 shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-(--on-surface-variant)">Yuklanmoqda...</div>
        ) : doktorantlar.length === 0 ? (
          <div className="py-8 text-center text-(--on-surface-variant)">Sizga doktorantlar biriktirilmagan.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {doktorantlar.map((doktorant) => (
              <div
                key={doktorant.id}
                className="space-y-4 rounded-xl border border-(--outline-variant) p-5 transition-all hover:border-(--outline) hover:shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-(--surface-container)">
                    {avatarUrls[doktorant.id] ? (
                      <img
                        src={avatarUrls[doktorant.id]}
                        alt={doktorant.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-(--on-surface-variant)">
                        {doktorant.full_name?.[0] ?? "D"}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold text-(--on-surface)">{doktorant.full_name}</h3>
                        <p className="text-xs text-(--on-surface-variant)">
                          ID: {doktorant.student_id} | Yil: {doktorant.enrollment_year}
                        </p>
                      </div>
                      <span
                        className="inline-block shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          background: "var(--primary-container)",
                          color: "var(--on-primary-container)",
                        }}
                      >
                        {thesisStatusMap[doktorant.thesis_status] || doktorant.thesis_status}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium text-(--on-surface-variant)">Mavzu:</p>
                  <p className="line-clamp-2 text-sm text-(--on-surface)">{doktorant.research_topic}</p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Link href={`/doktorantura/hisobotlar/${doktorant.id}`}>
                    <Button variant="outline" size="sm">
                      Hisobotlar
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
