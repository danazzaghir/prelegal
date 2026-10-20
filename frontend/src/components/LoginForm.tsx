"use client";

import Link from "next/link";
import { useState } from "react";
import { FormError, submitClass, TextField } from "@/components/ui";
import { useAuthForm } from "@/components/useAuthForm";
import { signIn } from "@/lib/auth";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, submitting, submit } = useAuthForm("Couldn't sign in. Please try again.");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submit(() => signIn(email.trim(), password));
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <TextField label="Email" type="email" required autoComplete="email" value={email} onChange={setEmail} />
      <TextField
        label="Password"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />
      <FormError message={error} />
      <button type="submit" disabled={submitting} className={`${submitClass} w-full py-2.5`}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-slate-600">
        New to Prelegal?{" "}
        <Link href="/signup/" className="font-medium text-[#209dd7] hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
