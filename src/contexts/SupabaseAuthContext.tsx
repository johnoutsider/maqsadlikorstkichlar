"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { CurrentUser } from "@/types/db";
import { useRouter } from "next/navigation";

interface SupabaseAuthContextType {
  user: CurrentUser | null;
  session: Session | null;
  authUser: SupabaseUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType>({
  user: null,
  session: null,
  authUser: null,
  loading: true,
  refresh: async () => {},
  signIn: async () => ({ error: "not initialized" }),
  signOut: async () => {},
});

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadProfile = useCallback(
    async (uid: string): Promise<CurrentUser | null> => {
      const { data, error } = await supabase
        .from("users")
        .select("*, roles!inner(name, scope)")
        .eq("id", uid)
        .maybeSingle();
      if (error || !data) return null;
      const { roles, ...rest } = data as any;
      return { ...rest, role: roles.name, role_scope: roles.scope } as CurrentUser;
    },
    [supabase]
  );

  const refresh = useCallback(async () => {
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);
      setAuthUser(s?.user ?? null);
      if (s?.user) {
        setUser(await loadProfile(s.user.id));
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error("[SupabaseAuth] refresh failed:", e);
      setSession(null);
      setAuthUser(null);
      setUser(null);
    }
  }, [supabase, loadProfile]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refresh();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      setAuthUser(s?.user ?? null);
      try {
        setUser(s?.user ? await loadProfile(s.user.id) : null);
      } catch (e) {
        console.error("[SupabaseAuth] loadProfile failed:", e);
        setUser(null);
      }
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, refresh, loadProfile, router]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setAuthUser(null);
  }, [supabase]);

  return (
    <SupabaseAuthContext.Provider value={{ user, session, authUser, loading, refresh, signIn, signOut }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  return useContext(SupabaseAuthContext);
}
