"use client";

import { useState } from "react";

const providers = [
  ["meta", "Instagram + Facebook", "#0866ff", "Meta"],
  ["tiktok", "TikTok", "#171717", "TikTok"],
  ["youtube", "YouTube Shorts", "#ff0033", "YouTube"],
  ["google_ads", "Google Ads", "#f9ab00", "Google"],
  ["search_console", "Search Console", "#34a853", "Google"],
  ["ga4", "Google Analytics 4", "#e37400", "Google"],
] as const;

export function GoogleConnections({
  brandId,
  returnTo,
}: {
  brandId: string;
  returnTo: string;
}) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<string>();
  async function connect(connector: string) {
    setPending(connector);
    setError(undefined);
    try {
      const response = await fetch("/api/connections/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandId, connector, returnTo }),
      });
      const value = (await response.json()) as {
        authorizationUrl?: string;
        detail?: string;
      };
      if (!response.ok || !value.authorizationUrl)
        throw new Error(value.detail ?? "Bağlantı başlatılamadı");
      window.location.assign(value.authorizationUrl);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Bağlantı başlatılamadı",
      );
      setPending(undefined);
    }
  }
  return (
    <div>
      <div className="provider-grid">
        {providers.map(([key, label, color, family]) => (
          <button
            className="provider-card"
            disabled={Boolean(pending)}
            key={key}
            onClick={() => void connect(key)}
            style={{ "--provider-color": color } as React.CSSProperties}
          >
            <span className="provider-monogram">{label.slice(0, 2)}</span>
            <span>
              <small>{family}</small>
              <strong>{label}</strong>
            </span>
            <i>{pending === key ? "···" : "↗"}</i>
          </button>
        ))}
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
