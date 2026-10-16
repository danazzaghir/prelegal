"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getSignedInEmail, signOut, subscribe } from "@/lib/session";

/** Shows who is signed in, with a way to go back to the login screen. */
export default function UserMenu() {
  const router = useRouter();
  // The page is prerendered, so the session is only known in the browser.
  const email = useSyncExternalStore(subscribe, getSignedInEmail, () => null);

  const onSignOut = () => {
    signOut();
    router.push("/");
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      {email && <span className="text-[#888888]">{email}</span>}
      <button onClick={onSignOut} className="font-medium text-[#209dd7] hover:underline">
        Sign out
      </button>
    </div>
  );
}
