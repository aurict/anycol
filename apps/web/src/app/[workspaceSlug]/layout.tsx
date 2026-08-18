import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet, type WorkspacePayload } from "../../lib/api";

const navigation = [
  ["overview", "Genel Bakış", "01"],
  ["campaigns", "Kampanyalar", "02"],
  ["calendar", "İçerik Takvimi", "03"],
  ["ads", "Reklamlar", "04"],
  ["seo", "SEO ve Arama", "05"],
  ["analytics", "Analiz", "06"],
  ["reports", "Raporlar", "07"],
  ["inbox", "Gelen Kutusu", "08"],
  ["automations", "Otomasyonlar", "09"],
  ["integrations", "Entegrasyonlar", "10"],
  ["settings", "Ayarlar", "11"],
] as const;

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await apiGet<WorkspacePayload>("/v1/workspace");
  if (!workspace || workspace.slug !== workspaceSlug) notFound();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-coordinate">41°01′ N — 28°58′ E</div>
        <Link className="brand" href="/">
          <span className="brand-mark">a/c</span>
          <span>anycol</span>
        </Link>
        <div className="workspace-switcher">
          <span className="avatar">
            {workspace.name.slice(0, 2).toUpperCase()}
          </span>
          <span>
            <small>WORKSPACE</small>
            <strong>{workspace.name}</strong>
          </span>
        </div>
        <nav>
          {navigation.map(([path, label, icon]) => (
            <Link key={path} href={`/${workspaceSlug}/${path}`}>
              <span className="nav-index">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <form action="/api/auth/logout" method="post">
            <button className="ghost-button" type="submit">
              Güvenli çıkış
            </button>
          </form>
        </div>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <div>
            <span className="mobile-brand">A</span>
            <span className="crumb">
              {workspace.name}
              {workspace.brands[0] ? ` / ${workspace.brands[0].name}` : ""}
            </span>
          </div>
          <div className="top-actions">
            <span className="edition">CONTROL ROOM / 26</span>
            <span className="data-live">
              <i /> SYSTEM LIVE
            </span>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
