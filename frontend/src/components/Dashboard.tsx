"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { primaryButtonClass } from "@/components/ui";
import { deleteAgreement, editedAgo, listAgreements, type AgreementSummary } from "@/lib/agreements";
import { useRequiredUser } from "@/lib/auth";

function AgreementRow({ agreement, onDeleted }: { agreement: AgreementSummary; onDeleted: (id: number) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    setError(null);
    try {
      await deleteAgreement(agreement.id);
      onDeleted(agreement.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete it. Please try again.");
      setConfirming(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
      <div className="min-w-0 flex-1">
        <Link
          href={`/documents/?id=${agreement.id}`}
          className="block break-words font-medium text-[#032147] hover:text-[#209dd7] hover:underline"
        >
          {agreement.title}
        </Link>
        <p className="mt-0.5 text-sm text-[#888888]">
          Draft, last edited <time dateTime={agreement.updatedAt}>{editedAgo(agreement.updatedAt)}</time>
        </p>
        {error && (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm">
        {confirming ? (
          <>
            <span className="text-slate-600">Delete this agreement?</span>
            <button onClick={onDelete} className="font-medium text-red-700 hover:underline">
              Delete
            </button>
            <button onClick={() => setConfirming(false)} className="text-slate-600 hover:underline">
              Keep
            </button>
          </>
        ) : (
          <>
            <Link href={`/documents/?id=${agreement.id}`} className="font-medium text-[#209dd7] hover:underline">
              Open
            </Link>
            <button
              onClick={() => setConfirming(true)}
              className="text-slate-500 hover:text-red-700 hover:underline"
              aria-label={`Delete ${agreement.title}`}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}

/** The signed-in user's saved agreements, newest first. */
export default function Dashboard() {
  const user = useRequiredUser();
  const [agreements, setAgreements] = useState<AgreementSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listAgreements()
      .then((list) => {
        if (!cancelled) setAgreements(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load your agreements.");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return <div className="min-h-screen bg-slate-50" aria-busy="true" />;

  const onDeleted = (id: number) => setAgreements((list) => list?.filter((a) => a.id !== id) ?? null);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader user={user} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#032147]">My agreements</h1>
            <p className="mt-1 text-sm text-slate-600">
              Drafts are saved as you chat. They last until Prelegal restarts.
            </p>
          </div>
          <Link href="/documents/" className={primaryButtonClass}>
            New agreement
          </Link>
        </div>

        <section aria-label="Agreements" className="mt-8 rounded-lg border border-slate-200 bg-white px-5">
          {error ? (
            <p role="alert" className="py-10 text-center text-sm text-red-700">
              {error}
            </p>
          ) : agreements === null ? (
            <p className="py-10 text-center text-sm text-[#888888]">Loading your agreements…</p>
          ) : agreements.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-medium text-[#032147]">You haven&apos;t drafted anything yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
                Describe the agreement you need, such as an NDA or a cloud service agreement, and the assistant will
                draft it with you.
              </p>
              <Link href="/documents/" className={`${primaryButtonClass} mt-5`}>
                Start your first agreement
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {agreements.map((a) => (
                <AgreementRow key={a.id} agreement={a} onDeleted={onDeleted} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
