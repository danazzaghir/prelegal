"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Wordmark from "@/components/Wordmark";
import { fetchUser } from "@/lib/auth";
import catalog from "../../../catalog.json";

// The agreements users can draft; the NDA cover page is part of the NDA.
const AGREEMENTS = catalog.templates
  .map((t) => t.name)
  .filter((name) => name !== "Mutual Non-Disclosure Agreement Cover Page");

/** The sign-in and sign-up screens: what Prelegal drafts on one side, the form on the other. */
export default function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();

  // Someone already signed in goes straight to their agreements.
  useEffect(() => {
    let cancelled = false;
    fetchUser()
      .then((user) => {
        if (user && !cancelled) router.replace("/dashboard/");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen flex-1 flex-col lg:flex-row">
      <aside className="bg-[#032147] px-6 py-10 text-white sm:px-10 lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:py-14">
        <div>
          <Wordmark className="text-3xl" />
          <p className="mt-6 max-w-sm text-lg leading-relaxed text-slate-200">
            Tell the assistant what you need. It drafts the agreement from Common Paper&apos;s standard terms, ready for
            your lawyer to review.
          </p>
        </div>
        <div className="mt-10 hidden lg:block">
          <h2 className="text-sm font-medium text-slate-300">Agreements you can draft</h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-100">
            {AGREEMENTS.map((name) => (
              <li key={name} className="border-l-2 border-[#ecad0a] pl-3">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex flex-1 items-start justify-center bg-slate-50 px-6 py-10 lg:items-center lg:py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-[#032147]">{title}</h1>
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
