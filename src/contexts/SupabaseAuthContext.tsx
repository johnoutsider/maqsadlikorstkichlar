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
  profileLoading: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType>({
  user: null,
  session: null,
  authUser: null,
  loading: true,
  profileLoading: true,
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
  const [profileLoading, setProfileLoading] = useState(true);
  const router = useRouter();

  // Track whether the INITIAL auth state event has been processed.
  // onAuthStateChange fires synchronously with INITIAL_SESSION on mount,
  // which is the single source of truth — we use it to set loading=false
  // instead of the manual refresh(), preventing the race condition.
  const initialEventProcessed = useRef(false);
  const authChangeSeq = useRef(0);

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
    const requestSeq = ++authChangeSeq.current;
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);
      setAuthUser(s?.user ?? null);
      if (s?.user) {
        setProfileLoading(true);
        const nextUser = await loadProfile(s.user.id);
        if (authChangeSeq.current !== requestSeq) return;
        setUser(nextUser);
        setProfileLoading(false);
      } else {
        setUser(null);
        setProfileLoading(false);
      }
    } catch (e) {
      console.error("[SupabaseAuth] refresh failed:", e);
      if (authChangeSeq.current !== requestSeq) return;
      setSession(null);
      setAuthUser(null);
      setUser(null);
      setProfileLoading(false);
    }
  }, [supabase, loadProfile]);

  useEffect(() => {
    // Subscribe to auth state changes.
    // The FIRST event is always INITIAL_SESSION — we use it to bootstrap
    // the entire auth state and then clear loading. This is the correct
    // pattern per the @supabase/ssr docs and avoids the race condition
    // where a manual getSession() + onAuthStateChange overlap.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setAuthUser(s?.user ?? null);

      const requestSeq = ++authChangeSeq.current;

      if (!s?.user) {
        setUser(null);
        setProfileLoading(false);
        if (!initialEventProcessed.current) {
          initialEventProcessed.current = true;
          setLoading(false);
        }
      } else {
        setProfileLoading(true);
      }

      // Do not await inside onAuthStateChange; Supabase can still be holding
      // its internal auth lock here, and async work can trip navigatorLock
      // contention in the browser.
      if (s?.user) {
        queueMicrotask(async () => {
          try {
            const nextUser = await loadProfile(s.user.id);
            if (authChangeSeq.current !== requestSeq) return;
            setUser(nextUser);
          } catch (e) {
            console.error("[SupabaseAuth] loadProfile failed:", e);
            if (authChangeSeq.current !== requestSeq) return;
            setUser(null);
          } finally {
            if (authChangeSeq.current === requestSeq) {
              setProfileLoading(false);
            }
            if (!initialEventProcessed.current) {
              initialEventProcessed.current = true;
              setLoading(false);
            }
          }
        });
      }

      // On sign-out, refresh server components so protected layouts
      // re-run their auth checks and redirect to /login.
      // On sign-in we do NOT refresh here — the login page already calls
      // router.push() which triggers a full navigation with the new cookie.
      // Calling router.refresh() on SIGNED_IN races against cookie propagation
      // and causes the server layout to see an empty session → redirect loop.
      if (event === "SIGNED_OUT") {
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
    authChangeSeq.current += 1;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setAuthUser(null);
    setProfileLoading(false);
  }, [supabase]);

  return (
    <SupabaseAuthContext.Provider value={{ user, session, authUser, loading, profileLoading, refresh, signIn, signOut }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  return useContext(SupabaseAuthContext);
}
