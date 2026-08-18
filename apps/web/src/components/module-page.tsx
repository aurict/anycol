import { apiGet, type WorkspacePayload } from "../lib/api";
import { GoogleConnections } from "./google-connections";
import { SyncAccount } from "./sync-account";

type Connection = {
  id: string;
  connector: string;
  status: string;
  lastSyncAt: string | null;
  accounts: Array<{ id: string; name: string }>;
};
const modules: Record<
  string,
  { title: string; detail: string; available: boolean }
> = {
  campaigns: {
    title: "Kampanyalar",
    detail:
      "Kampanya ve UTM çekirdeği hazır; kalıcı yönetim ekranı GA kapsamında değildir.",
    available: false,
  },
  calendar: {
    title: "İçerik takvimi",
    detail:
      "Onay durum makinesi hazır; onaylı publisher adaptörü olmadan yayınlama kapalıdır.",
    available: false,
  },
  ads: {
    title: "Reklamlar",
    detail:
      "Google Ads verileri senkronize edildiğinde Genel Bakış ekranında görünür.",
    available: true,
  },
  seo: {
    title: "SEO ve Arama",
    detail:
      "Search Console verileri senkronize edildiğinde Genel Bakış ekranında görünür.",
    available: true,
  },
  analytics: {
    title: "Analiz",
    detail:
      "GA4 verileri senkronize edildiğinde Genel Bakış ekranında görünür.",
    available: true,
  },
  reports: {
    title: "Raporlar",
    detail:
      "Snapshot ve CSV çekirdeği mevcut; PDF/e-posta teslimatı etkin değildir.",
    available: false,
  },
  inbox: {
    title: "Gelen Kutusu",
    detail:
      "Sağlayıcı webhook onayı ve canlı adaptör olmadan bu özellik kapalıdır.",
    available: false,
  },
  automations: {
    title: "Otomasyonlar",
    detail:
      "Harici aksiyonlar için kullanıcı onayı ve sağlayıcı adaptörü gereklidir.",
    available: false,
  },
  integrations: {
    title: "Entegrasyonlar",
    detail:
      "Instagram, Facebook, TikTok, YouTube Shorts ve Google veri hatlarını tek yerden yönetin.",
    available: true,
  },
  settings: {
    title: "Ayarlar",
    detail:
      "Üyelik ve rol değişiklikleri yönetilen operasyon akışıyla yapılır.",
    available: false,
  },
};

export async function ModulePage({
  section,
  workspaceSlug,
}: {
  section: string;
  workspaceSlug: string;
}) {
  const module = modules[section];
  const [workspace, connections] =
    section === "integrations"
      ? await Promise.all([
          apiGet<WorkspacePayload>("/v1/workspace"),
          apiGet<Connection[]>("/v1/connections"),
        ])
      : [null, null];
  return (
    <main className="dashboard module-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {module.available ? "KONTROLLÜ ERİŞİM" : "HENÜZ GA DEĞİL"}
          </p>
          <h1>
            {module.title}
            <em>.</em>
          </h1>
          <p>{module.detail}</p>
        </div>
      </div>
      <section className="panel module-board">
        <div className="empty-state">
          <span>{module.available ? "↗" : "×"}</span>
          <h3>
            {module.available
              ? "Canlı altyapıya bağlı"
              : "Production’da kapalı"}
          </h3>
          <p>
            Bağlantılar şifreli saklanır; veri yalnızca izin verdiğiniz
            kapsamlarla okunur.
          </p>
          {section === "integrations" && workspace?.brands[0] ? (
            <GoogleConnections
              brandId={workspace.brands[0].id}
              returnTo={`/${workspaceSlug}/integrations`}
            />
          ) : null}
        </div>
      </section>
      {section === "integrations" && connections?.length ? (
        <section className="panel">
          <h2>Bağlı hesaplar</h2>
          {connections.flatMap((connection) =>
            connection.accounts.map((account) => (
              <div className="action-row" key={account.id}>
                <span>✓</span>
                <div>
                  <strong>{account.name}</strong>
                  <p>
                    {connection.connector} · {connection.status}
                    {connection.lastSyncAt ? ` · ${connection.lastSyncAt}` : ""}
                  </p>
                </div>
                <SyncAccount
                  connector={connection.connector}
                  connectionId={connection.id}
                  externalAccountId={account.id}
                />
              </div>
            )),
          )}
        </section>
      ) : null}
    </main>
  );
}
