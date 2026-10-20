"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

export type User = { id: number; name: string; email: string };

export const signUp = (name: string, email: string, password: string) =>
  api<User>("/api/auth/signup", { method: "POST", body: { name, email, password } });

export const signIn = (email: string, password: string) =>
  api<User>("/api/auth/signin", { method: "POST", body: { email, password } });

export const signOut = () => api<void>("/api/auth/signout", { method: "POST" });

/** The signed-in user, or null when nobody is signed in. */
export async function fetchUser(): Promise<User | null> {
  try {
    return await api<User>("/api/auth/me");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

/**
 * The signed-in user for a page that needs one. Signed-out visitors are sent
 * to the sign-in screen; until then (and while checking) it returns null.
 */
export function useRequiredUser(): User | null {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUser()
      .then((found) => {
        if (cancelled) return;
        if (found) setUser(found);
        else router.replace("/");
      })
      .catch(() => {
        if (!cancelled) router.replace("/");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return user;
}
