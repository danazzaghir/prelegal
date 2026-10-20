"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "@/lib/session";

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#209dd7] focus:outline-none focus:ring-1 focus:ring-[#209dd7]";

/** Fake login: any email and password bring the user into the platform. */
export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signIn(email);
    router.push("/documents/");
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-800">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-800">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button
        type="submit"
        className="w-full rounded-md bg-[#753991] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#62307a] focus:outline-none focus:ring-2 focus:ring-[#753991] focus:ring-offset-2"
      >
        Sign in
      </button>
    </form>
  );
}
