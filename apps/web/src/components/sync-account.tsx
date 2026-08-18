"use client";

import { useState } from "react";

export function SyncAccount({
  connector,
  connectionId,
  externalAccountId,
}: {
  connector: string;
  connectionId: string;
  externalAccountId: string;
}) {
  const [state, setState] = useState<"idle" | "pending" | "queued" | "error">(
    "idle",
  );
  async function sync() {
    setState("pending");
    const to = new Date();
    const from = new Date(to.getTime() - 29 * 86_400_000);
    const response = await fetch("/api/sync-jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connector,
        connectionId,
        externalAccountId,
        mode: "backfill",
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    }).catch(() => null);
    setState(response?.ok ? "queued" : "error");
  }
  return (
    <button
      className="ghost-button"
      disabled={state === "pending" || state === "queued"}
      onClick={() => void sync()}
    >
      {state === "pending"
        ? "Ekleniyor…"
        : state === "queued"
          ? "Kuyruğa alındı"
          : state === "error"
            ? "Tekrar dene"
            : "30 günü senkronize et"}
    </button>
  );
}
