"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Wordmark from "@/components/Wordmark";
import { signOut, type User } from "@/lib/auth";

const NAV = [
  { href: "/dashboard/", label: "My agreements" },
  { href: "/documents/", label: "New agreement" },
];

/** The bar at the top of every signed-in page. */
export default function AppHeader({ user, children }: { user: User; children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      // Back to sign-in either way; a failed sign-out just leaves an old cookie.
      router.push("/");
    }
  };

  return (
    <header className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3">
        <Link href="/dashboard/" className="text-xl text-[#032147]" aria-label="Prelegal home">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="flex gap-6 text-sm">
          {NAV.map(({ href, label }) => {
            const current = pathname.replace(/\/$/, "") === href.replace(/\/$/, "");
            return (
              <Link
                key={href}
                href={href}
                aria-current={current ? "page" : undefined}
                className={
                  current
                    ? "border-b-2 border-[#209dd7] pb-1 font-medium text-[#032147]"
                    : "border-b-2 border-transparent pb-1 text-slate-600 hover:text-[#032147]"
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          {children}
          <span className="hidden text-[#888888] sm:inline" title={user.email}>
            {user.name}
          </span>
          <button
            onClick={onSignOut}
            disabled={signingOut}
            className="font-medium text-[#209dd7] hover:underline disabled:opacity-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
