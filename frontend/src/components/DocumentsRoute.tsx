"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import DocumentCreator from "@/components/DocumentCreator";

/**
 * Starts a fresh creator whenever the address names a different agreement
 * (?id=3) or none, but not when the address changes to an agreement the
 * creator has just saved for the first time.
 */
export default function DocumentsRoute() {
  const id = Number(useSearchParams().get("id")) || null;
  // urlId: the ?id this route last acted on. createdId: an agreement the
  // creator has just saved. key: changes to start a fresh creator.
  const [route, setRoute] = useState({ urlId: id, createdId: null as number | null, key: 0 });

  if (id !== route.urlId) {
    const justCreated = id !== null && id === route.createdId;
    setRoute({ urlId: id, createdId: justCreated ? id : null, key: justCreated ? route.key : route.key + 1 });
  }

  // Put a newly saved agreement's id in the address, so a reload or bookmark
  // reopens it. This runs after createdId is stored, so the address change
  // above is recognized as ours.
  useEffect(() => {
    if (route.createdId !== null && route.createdId !== route.urlId) {
      window.history.replaceState(null, "", `/documents/?id=${route.createdId}`);
    }
  }, [route.createdId, route.urlId]);

  return (
    <DocumentCreator
      key={route.key}
      savedId={route.urlId}
      // Only this creator's save counts: one finishing after "New agreement" is ignored.
      onCreated={(created) =>
        setRoute((current) => (current.key === route.key ? { ...current, createdId: created } : current))
      }
    />
  );
}
