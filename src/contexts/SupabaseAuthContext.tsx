"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
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

  // Track whether the INITIAL auth state event has been processed.
  // onAuthStateChange fires synchronously with INITIAL_SESSION on mount,
  // which is the single source of truth — we use it to set loading=false
  // instead of the manual refresh(), preventing the race condition.
  const initialEventProcessed = useRef(false);

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
    // Subscribe to auth state changes.
    // The FIRST event is always INITIAL_SESSION — we use it to bootstrap
    // the entire auth state and then clear loading. This is the correct
    // pattern per the @supabase/ssr docs and avoids the race condition
    // where a manual getSession() + onAuthStateChange overlap.
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      setAuthUser(s?.user ?? null);

      try {
        setUser(s?.user ? await loadProfile(s.user.id) : null);
      } catch (e) {
        console.error("[SupabaseAuth] loadProfile failed:", e);
        setUser(null);
      }

      // Clear loading after the very first event (INITIAL_SESSION).
      // All subsequent signIn / signOut events are live updates.
      if (!initialEventProcessed.current) {
        initialEventProcessed.current = true;
        setLoading(false);
      }

      // Force Next.js to invalidate its server-component cache so the
      // layout re-renders with the latest cookie-based session state.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // intentionally empty — supabase client is stable, router is stable

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
