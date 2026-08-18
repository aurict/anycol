import { notFound } from "next/navigation";
import {
  apiGet,
  type OverviewPayload,
  type WorkspacePayload,
} from "../lib/api";

const labels: Record<string, string> = {
  impressions: "Gösterim",
  clicks: "Tıklama",
  cost: "Toplam harcama",
  conversions: "Dönüşüm",
  video_views: "Video izlenmesi",
  engagements: "Etkileşim",
  followers: "Yeni takipçi",
};

export async function DashboardOverview({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  const workspace = await apiGet<WorkspacePayload>("/v1/workspace");
  if (!workspace || workspace.slug !== workspaceSlug) notFound();
  const brand = workspace.brands[0];
  if (!brand)
    return (
      <Empty
        title="Henüz marka yok"
        detail="Gerçek metrikleri görmek için bu workspace’e bir marka ve veri bağlantısı ekleyin."
      />
    );
  const overview = await apiGet<OverviewPayload>(
    `/v1/brands/${brand.id}/overview`,
  );
  if (!overview)
    return (
      <Empty
        title="Veri servisi kullanılamıyor"
        detail="API, PostgreSQL veya Redis readiness kontrollerini ve bağlantı durumunu inceleyin."
      />
    );
  const hasData = overview.metrics.some((item) => item.value !== 0);
  const maximum = Math.max(
    ...overview.metrics.map((item) => Math.abs(item.value)),
    1,
  );
  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            SIGNAL OVERVIEW / {overview.range.to.slice(0, 4)}
          </p>
          <h1>
            {brand.name}
            <em>’in</em>
            <br /> nabzı.
          </h1>
          <p>
            {workspace.name} içindeki tüm kanallar, tek bir karar yüzeyinde.
          </p>
        </div>
        <div className="date-stamp">
          <span>RANGE</span>
          <strong>{overview.range.from}</strong>
          <i>→</i>
          <strong>{overview.range.to}</strong>
        </div>
      </div>
      {overview.alerts.map((alert) => (
        <section className="alert-banner" key={alert.id}>
          <span>!</span>
          <div>
            <strong>{alert.title}</strong>
            <p>{alert.detail}</p>
          </div>
        </section>
      ))}
      <section className="metric-grid">
        {overview.metrics.map((item, index) => (
          <article
            className={`metric-card metric-${index + 1}`}
            key={item.metric}
          >
            <div>
              <small>
                {String(index + 1).padStart(2, "0")} /{" "}
                {(labels[item.metric] ?? item.metric).toUpperCase()}
              </small>
              <span className="source-mark">{sourceLabel(item.source)}</span>
            </div>
            <strong>{formatMetric(item)}</strong>
            <p>{delta(item)}</p>
            <div className="metric-meter" aria-hidden="true">
              <i
                style={{
                  width: `${Math.max(3, (Math.abs(item.value) / maximum) * 100)}%`,
                }}
              />
            </div>
            <footer>
              {item.source.replaceAll("_", " ")}
              <span>
                <i /> {item.quality}
              </span>
            </footer>
          </article>
        ))}
      </section>
      <section className="signal-ledger">
        <div>
          <p className="eyebrow">CHANNEL LEDGER</p>
          <h2>
            Kanallar ayrı konuşur.
            <br />
            <em>Anycol birlikte okur.</em>
          </h2>
        </div>
        <ol>
          {[
            "Instagram / Meta",
            "TikTok",
            "YouTube Shorts",
            "Google Ads",
            "GA4 + Search",
          ].map((channel, index) => (
            <li key={channel}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{channel}</strong>
              <i />
            </li>
          ))}
        </ol>
      </section>
      {!hasData ? (
        <section className="panel module-board">
          <div className="empty-state">
            <span>∅</span>
            <h3>Henüz senkronize veri yok</h3>
            <p>Google bağlantısını tamamlayıp ilk backfill işini başlatın.</p>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    meta: "M",
    tiktok: "TT",
    youtube: "YT",
    google_ads: "G",
    search_console: "SC",
    ga4: "A4",
  };
  return labels[source] ?? "∿";
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="dashboard">
      <section className="panel module-board">
        <div className="empty-state">
          <span>!</span>
          <h3>{title}</h3>
          <p>{detail}</p>
        </div>
      </section>
    </main>
  );
}
function formatMetric(item: OverviewPayload["metrics"][number]): string {
  if (item.unit === "currency")
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: item.currency ?? "TRY",
    }).format(item.value);
  return new Intl.NumberFormat("tr-TR").format(item.value);
}
function delta(item: OverviewPayload["metrics"][number]): string {
  if (item.previousValue === null) return "Önceki dönem verisi yok";
  if (item.previousValue === 0)
    return item.value === 0 ? "Değişim yok" : "Yeni veri";
  return `${new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 }).format((item.value - item.previousValue) / item.previousValue)} önceki döneme göre`;
}
