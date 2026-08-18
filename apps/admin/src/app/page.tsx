import { cookies } from "next/headers";

type Health = {
  connectors: Array<{ key: string; status: string }>;
  services: string[];
  queues: Record<string, string>;
};

export default async function AdminPage() {
  const token = (await cookies()).get("anycol_session")?.value;
  let health: Health | null = null;
  if (token && process.env.API_BASE_URL) {
    try {
      const response = await fetch(
        new URL("/v1/admin/health", process.env.API_BASE_URL),
        {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (response.ok) health = (await response.json()) as Health;
    } catch {
      health = null;
    }
  }
  return (
    <main>
      <header>
        <strong>
          <i>A</i> Anycol Operations
        </strong>
        <span>Yetkili admin oturumu</span>
      </header>
      <section>
        <p className="eyebrow">PRODUCTION CONTROL PLANE</p>
        <h1>Sistem sağlığı</h1>
        {!health ? (
          <div className="panel">
            <h2>Health API kullanılamıyor</h2>
            <p>Readiness veya admin yetkisini kontrol edin.</p>
          </div>
        ) : (
          <>
            <div className="grid">
              {health.services.map((name) => (
                <article key={name}>
                  <span>{name}</span>
                  <b>
                    <i />
                    Configured
                  </b>
                </article>
              ))}
            </div>
            <div className="panel">
              <h2>Connector durumu</h2>
              {health.connectors.map((item) => (
                <div className="row" key={item.key}>
                  <span>{item.key}</span>
                  <code>{item.status}</code>
                </div>
              ))}
              {Object.entries(health.queues).map(([name, status]) => (
                <div className="row" key={name}>
                  <span>{name} queue</span>
                  <code>{status}</code>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
