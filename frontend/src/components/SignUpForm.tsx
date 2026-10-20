"use client";

import Link from "next/link";
import { useState } from "react";
import { FormError, submitClass, TextField } from "@/components/ui";
import { useAuthForm } from "@/components/useAuthForm";
import { signUp } from "@/lib/auth";

const MIN_PASSWORD = 8;

export default function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, setError, submitting, submit } = useAuthForm("Couldn't create your account. Please try again.");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
      return;
    }
    void submit(() => signUp(name.trim(), email.trim(), password));
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <TextField label="Name" required maxLength={100} autoComplete="name" value={name} onChange={setName} />
      <TextField label="Email" type="email" required autoComplete="email" value={email} onChange={setEmail} />
      <TextField
        label="Password"
        hint={`At least ${MIN_PASSWORD} characters`}
        type="password"
        required
        minLength={MIN_PASSWORD}
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
      />
      <FormError message={error} />
      <button type="submit" disabled={submitting} className={`${submitClass} w-full py-2.5`}>
        {submitting ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/" className="font-medium text-[#209dd7] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
