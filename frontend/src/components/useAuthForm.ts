"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Submitting the sign-in or sign-up form: runs `action`, goes to the dashboard
 * when it succeeds, and shows its error otherwise.
 */
export function useAuthForm(fallbackError: string) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (action: () => Promise<unknown>) => {
    setError(null);
    setSubmitting(true);
    try {
      await action();
      router.push("/dashboard/");
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackError);
      setSubmitting(false);
    }
  };

  return { error, setError, submitting, submit };
}
