import Link from "next/link";

const channels = [
  {
    code: "IG",
    name: "Instagram",
    detail: "İçerik ve etkileşim",
    tone: "meta",
  },
  {
    code: "FB",
    name: "Facebook + Meta Ads",
    detail: "Reklam ve sayfa sinyalleri",
    tone: "meta",
  },
  {
    code: "TT",
    name: "TikTok",
    detail: "Organik video performansı",
    tone: "tiktok",
  },
  {
    code: "YT",
    name: "YouTube Shorts",
    detail: "Shorts izlenme davranışı",
    tone: "youtube",
  },
  {
    code: "GA",
    name: "Google Ads",
    detail: "Harcama ve dönüşüm",
    tone: "google",
  },
  {
    code: "G4",
    name: "GA4 + Search",
    detail: "Trafik, arama ve davranış",
    tone: "analytics",
  },
] as const;

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Ana navigasyon">
        <Brand />
        <div className="landing-links">
          <a href="#platform">Platform</a>
          <a href="#channels">Kanallar</a>
          <a href="#security">Güvenlik</a>
        </div>
        <div className="nav-actions">
          <Link href="/login">Giriş yap</Link>
          <Link className="button small" href="/login">
            Anycol’u aç
          </Link>
        </div>
      </nav>

      <section className="hero">
        <aside className="hero-rail">
          <span>ANYCOL / SIGNAL OS</span>
          <i>PAZARLAMA KARAR SİSTEMİ</i>
        </aside>
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" /> 06 BAĞLANTI / TEK GERÇEK
          </div>
          <h1>
            Dağınık sinyaller.
            <br />
            <span>Net kararlar.</span>
          </h1>
          <div className="hero-bottom">
            <p>
              Reklamı, aramayı ve sosyal videoyu aynı ritimde okuyun. Gürültü
              azalır; bir sonraki hamle görünür olur.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/login">
                Kontrol odasına gir ↗
              </Link>
              <a className="ghost-button" href="#platform">
                Sistemi keşfet
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="signal-grid" aria-label="Anycol veri katmanları">
        <article>
          <small>01 / PAID</small>
          <strong>Meta + Google</strong>
          <span>Harcama, gösterim, dönüşüm</span>
        </article>
        <article>
          <small>02 / SOCIAL VIDEO</small>
          <strong>TikTok + Shorts</strong>
          <span>İzlenme, etkileşim, büyüme</span>
        </article>
        <article>
          <small>03 / OWNED</small>
          <strong>Search + GA4</strong>
          <span>Talep, trafik, davranış</span>
        </article>
      </section>

      <section className="feature-strip" aria-label="Desteklenen platformlar">
        <span>Instagram</span>
        <span>Facebook</span>
        <span>Meta Ads</span>
        <span>TikTok</span>
        <span>YouTube Shorts</span>
        <span>Google Ads</span>
        <span>Search Console</span>
        <span>GA4</span>
      </section>

      <section className="landing-section thesis" id="platform">
        <header className="section-heading">
          <p className="eyebrow">01 / KARAR YÜZEYİ</p>
          <h2>
            Rapor değil.
            <br />
            <em>Ortak hafıza.</em>
          </h2>
        </header>
        <div className="thesis-copy">
          <p>
            Her kanal başka bir metrik dili konuşur. Anycol bu dilleri tek bir
            günlük veri modelinde buluşturur; ekipler aynı sayıya bakar, aynı
            bağlamda karar verir.
          </p>
          <dl>
            <div>
              <dt>01</dt>
              <dd>Doğrudan sağlayıcı API’leri</dd>
            </div>
            <div>
              <dt>02</dt>
              <dd>Kaynak ve kalite izi korunmuş metrikler</dd>
            </div>
            <div>
              <dt>03</dt>
              <dd>Dönem karşılaştırmalı karar görünümü</dd>
            </div>
          </dl>
        </div>
        <div className="decision-board" aria-label="Anycol karar akışı">
          <div className="board-head">
            <span>LIVE SIGNAL MAP</span>
            <i />
            <span>WORKSPACE / BRAND</span>
          </div>
          <div className="board-grid">
            <article>
              <small>INPUT</small>
              <strong>08</strong>
              <span>Kanal sinyali</span>
            </article>
            <article>
              <small>NORMALIZE</small>
              <strong>01</strong>
              <span>Ortak veri dili</span>
            </article>
            <article>
              <small>DECIDE</small>
              <strong>↗</strong>
              <span>Kanıtlı aksiyon</span>
            </article>
          </div>
          <footer>
            <span>Kaynak → kalite → zaman</span>
            <span>NO BLACK BOX</span>
          </footer>
        </div>
      </section>

      <section className="landing-section channel-section" id="channels">
        <div className="channel-intro">
          <p className="eyebrow">02 / CONNECTOR NETWORK</p>
          <h2>
            Kanallar ayrı.
            <br />
            <em>Bakış tek.</em>
          </h2>
          <p>
            Her bağlantı yalnızca verdiğiniz izinlerle çalışır. Hesabınızı
            bağlayın, tarih aralığını seçin ve doğrulanabilir veriyi içeri alın.
          </p>
        </div>
        <div className="channel-wall">
          {channels.map((channel, index) => (
            <article
              className={`channel-tile tone-${channel.tone}`}
              key={channel.name}
            >
              <span className="channel-code">{channel.code}</span>
              <small>{String(index + 1).padStart(2, "0")} / READ</small>
              <strong>{channel.name}</strong>
              <p>{channel.detail}</p>
              <i>↗</i>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section workflow-section">
        <header className="section-heading compact">
          <p className="eyebrow">03 / ÇALIŞMA RİTMİ</p>
          <h2>Bağla. Oku. Karar ver.</h2>
        </header>
        <ol className="workflow-list">
          <li>
            <span>01</span>
            <div>
              <strong>Yetkilendir</strong>
              <p>
                Hesabınızı sağlayıcının kendi OAuth ekranında güvenle bağlayın.
              </p>
            </div>
            <i>CONNECT</i>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Senkronize et</strong>
              <p>
                Seçtiğiniz tarih aralığını kalıcı ve tekrar denenebilir işlerle
                alın.
              </p>
            </div>
            <i>NORMALIZE</i>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Birlikte oku</strong>
              <p>
                Kaynak, kalite ve önceki dönem bağlamını kaybetmeden
                karşılaştırın.
              </p>
            </div>
            <i>DECIDE</i>
          </li>
        </ol>
      </section>

      <section className="security-section" id="security">
        <div className="security-orbit" aria-hidden="true">
          <span>RLS</span>
        </div>
        <div className="security-copy">
          <p className="eyebrow">04 / TRUST ARCHITECTURE</p>
          <h2>
            Veriniz içeride.
            <br />
            <em>Sınırlar görünür.</em>
          </h2>
          <p>
            Workspace izolasyonu, şifreli bağlantı bilgileri, kısa ömürlü
            oturumlar ve salt-okunur sağlayıcı kapsamları ürünün sonradan
            eklenen değil, başlangıçtan tasarlanan parçalarıdır.
          </p>
        </div>
        <ul className="security-ledger">
          <li>
            <span>01</span>
            <strong>PostgreSQL row-level security</strong>
            <i>ENFORCED</i>
          </li>
          <li>
            <span>02</span>
            <strong>Şifreli OAuth credential saklama</strong>
            <i>SEALED</i>
          </li>
          <li>
            <span>03</span>
            <strong>OIDC + PKCE oturum akışı</strong>
            <i>VERIFIED</i>
          </li>
          <li>
            <span>04</span>
            <strong>Denetlenebilir senkronizasyon işleri</strong>
            <i>TRACEABLE</i>
          </li>
        </ul>
      </section>

      <section className="closing-section">
        <p className="eyebrow">THE SIGNAL IS ALREADY THERE</p>
        <h2>
          Şimdi onu
          <br />
          <em>birlikte okuyun.</em>
        </h2>
        <Link className="button closing-button" href="/login">
          Anycol workspace’ine gir ↗
        </Link>
      </section>

      <footer className="landing-footer">
        <Brand />
        <p>Pazarlama verisini karar sistemine dönüştürür.</p>
        <div>
          <a href="#platform">Platform</a>
          <a href="#channels">Entegrasyonlar</a>
          <Link href="/login">Giriş</Link>
        </div>
        <small>© {new Date().getUTCFullYear()} ANYCOL / AURİCT NETWORK</small>
      </footer>
    </main>
  );
}

function Brand() {
  return (
    <Link className="brand" href="/">
      <span className="brand-mark">a/c</span>
      <span>anycol</span>
    </Link>
  );
}
