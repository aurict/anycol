# Anycol v1.0 production kod planı

Tarih: 6 Ağustos 2026  
Temel web teknolojisi: Next.js App Router + TypeScript  
Belgenin amacı: Boş repodan güvenli ve işletilebilir production v1.0 sürümüne kadar uygulanacak kod planını fazlara ayırmak.

## 1. Production v1.0 tanımı

Bu belgede “final production”, bütün gelecekteki fikirlerin bittiği sürüm değil; gerçek müşterilerin ücret ödeyerek güvenle kullanabileceği, desteklenebilir ve ölçeklenebilir **v1.0 genel erişim sürümü** anlamına gelir.

Production v1.0 kapsamı:

- Çok kiracılı workspace, müşteri ve marka yönetimi
- Güvenli kimlik doğrulama, RBAC ve audit log
- Google Ads, Search Console ve GA4 bağlantıları
- Meta Ads raporlama
- Instagram ve Facebook içerik planlama/yayınlama
- LinkedIn, TikTok, YouTube ve Google Business Profile temel bağlantıları
- Kampanya, hedef, UTM ve içerik yönetimi
- Birleşik performans dashboard'ları
- Rapor oluşturma, PDF/CSV ve white-label paylaşım
- Uyarı, açıklanabilir AI içgörüsü ve kullanıcı onaylı aksiyon
- Abonelik, kota, yönetim ve destek araçları
- KVKK/GDPR veri silme, dışa aktarma ve saklama iş akışları
- Production gözlemlenebilirliği, yedekleme, olay müdahalesi ve kontrollü dağıtım

v1.0 dışında bırakılacaklar:

- Tam kapsamlı sosyal listening veri lisansları
- Kullanıcı onayı olmadan reklam bütçesi/teklif değiştirme
- Native iOS/Android uygulamaları
- Her sosyal ağın bütün gönderi formatları
- Enterprise veri ambarına çift yönlü veri yazma
- X gibi maliyet ve erişim modeli öngörülemeyen kanallar

Bu sınır, production kalitesini geniş ama yarım entegrasyonlara feda etmemek için korunacaktır.

## 2. Sabit teknik kararlar

### Uygulama yaklaşımı

- Web: Next.js App Router, React Server Components ve TypeScript
- API: Fastify tabanlı ayrı TypeScript uygulaması
- Worker: API ile ortak domain paketlerini kullanan ayrı Node.js süreçleri
- Paket yönetimi: `Bun` workspace
- Monorepo orkestrasyonu: Turborepo
- Veritabanı: PostgreSQL
- SQL/şema yönetimi: Drizzle ORM + sürümlü SQL migration
- Kuyruk: Redis + BullMQ
- Nesne ve medya depolama: S3 uyumlu servis
- Şema doğrulama: Zod
- API sözleşmesi: OpenAPI 3.1; koddan üretilen istemci
- Kimlik: Auth.js tabanlı oturum yönetimi; enterprise SSO için OIDC/SAML adaptasyon katmanı
- Stil ve bileşenler: Tailwind CSS + erişilebilir, projeye ait UI paketi
- Formlar: Server Action yalnız web'e özgü güvenli işlemlerde; ana iş mantığı API/domain servislerinde
- Unit/integration test: Vitest
- Tarayıcı E2E: Playwright
- Gözlemlenebilirlik: OpenTelemetry + yapılandırılmış log + hata takip sistemi
- Feature flag: sağlayıcıdan bağımsız iç arayüz
- Dağıtım: Docker image; web, API, worker ve scheduler ayrı servisler

Kesin kütüphane sürümleri repository oluşturulduğu gün kararlı sürümlere kilitlenecek; lockfile olmadan production build yapılmayacaktır.

### Mimari sınırlar

1. Next.js doğrudan dış sosyal/reklam API'lerine bağlanmaz.
2. OAuth callback, kısa web işlemleri ve okuma istekleri API üzerinden yürür.
3. Backfill, rapor üretimi, medya işleme ve yayınlama kuyruk/worker üzerinden yürür.
4. Platforma özel veri UI bileşenlerine sızmaz; connector katmanında kanonik modele çevrilir.
5. Her veri erişiminde `workspace_id` zorunludur.
6. UI'da gizlenen buton yetkilendirme sayılmaz; API ve veri erişim katmanı her işlemi doğrular.
7. Dış sistem yazma işlemleri idempotency key ve audit kaydı olmadan yapılamaz.
8. AI modeli doğrudan production SQL veya platform API çağrısı çalıştıramaz.

## 3. Hedef repository yapısı

```text
anycol/
  apps/
    web/                       # Next.js App Router
      src/app/
        (public)/
        (auth)/
        (dashboard)/[workspaceSlug]/
        api/health/
      src/components/
      src/features/
      src/lib/
      instrumentation.ts
      next.config.ts
    api/                       # Fastify REST API
      src/modules/
      src/plugins/
      src/http/
      src/server.ts
    worker/                    # Kuyruk tüketicileri
      src/processors/
      src/schedulers/
      src/worker.ts
    admin/                     # İç operasyon paneli; Next.js
  packages/
    auth/                      # Oturum, permission ve policy
    config/                    # Tip güvenli ortam ayarları
    db/                        # Şema, RLS, migration, seed
    domain/                    # İş kuralları ve use-case'ler
    contracts/                 # Zod/OpenAPI DTO ve event şemaları
    api-client/                # Üretilen tip güvenli istemci
    connectors-core/           # Ortak connector SDK
    connector-google-ads/
    connector-search-console/
    connector-ga4/
    connector-meta/
    connector-linkedin/
    connector-tiktok/
    connector-youtube/
    connector-google-business/
    metrics/                   # Metrik sözlüğü ve hesaplamalar
    jobs/                      # Kuyruk adı/payload/retry politikaları
    media/                     # Yükleme ve platform doğrulama
    reports/                   # Rapor modeli ve render işlemleri
    ai/                        # Model sağlayıcı adaptörü ve guardrail
    observability/             # Log, trace, metric, redaction
    security/                  # Encryption, webhook ve imza yardımcıları
    testkit/                   # Fixture, factory, fake server
    ui/                        # Ortak erişilebilir bileşenler
  infra/
    terraform/
    docker/
    monitoring/
  docs/
    adr/
    api/
    runbooks/
    security/
  scripts/
  .github/workflows/
  package.json
  pnpm-workspace.yaml
  turbo.json
```

### Bağımlılık yönü

```text
web/admin -> api-client/contracts/ui
api       -> domain/auth/contracts/db/jobs
worker    -> domain/connectors/metrics/jobs/db
domain    -> contracts (db veya framework bağımlılığı yok)
connectors -> connectors-core/contracts/security
```

Döngüsel paket bağımlılığı CI tarafından reddedilecektir.

## 4. Kodlama standartları ve merge kapıları

Her pull request için zorunlu kontroller:

- TypeScript strict typecheck
- ESLint ve format kontrolü
- Unit ve integration testleri
- Değişen connector için contract testleri
- Veritabanı migration dry-run
- OpenAPI geriye uyumluluk kontrolü
- Dependency, secret ve statik güvenlik taraması
- Production build: web, API, worker ve admin
- Kritik kullanıcı yolları için Playwright smoke testi
- Bundle boyutu ve migration süresi bütçesi

Kod kuralları:

- `any` yalnız açıklamalı istisna ile kullanılabilir.
- Hata yutulmaz; tipli domain/connector hata sınıfları kullanılır.
- Tarihler UTC saklanır; kullanıcı/hesap saat dilimi ayrıca tutulur.
- Para değerleri kayan nokta değil, minor unit veya decimal olarak saklanır.
- PII ve token loglanmaz; log redaction merkezi uygulanır.
- Mutation endpoint'lerinde idempotency anahtarı kullanılır.
- Liste endpoint'leri cursor pagination kullanır.
- Her dış çağrıda timeout, retry sınıflandırması ve trace context bulunur.
- Feature kodu doğrudan `process.env` okumaz; tip güvenli config paketini kullanır.
- Kullanıcıya gösterilen tüm metriklerin tanımı ve kaynak alanı bulunur.

Branch ve sürümleme:

- Kısa ömürlü feature branch
- En az bir teknik inceleme
- Ana dal her zaman dağıtılabilir
- Conventional commit zorunlu değil; değişiklik notu zorunlu
- Otomatik semantik sürümleme yerine v1.0 öncesi ürün sürüm takvimi
- Database migration'larda expand → migrate → contract düzeni

## 5. Faz özeti

| Faz | Konu                                  | Tahmini süre | Ana çıktı                                  |
| --- | ------------------------------------- | -----------: | ------------------------------------------ |
| 0   | Mimari kararlar ve ürün kontratı      |      1 hafta | ADR, scope, metrik sözlüğü çekirdeği       |
| 1   | Monorepo ve delivery altyapısı        |      2 hafta | Çalışan Next.js/API/worker, CI/CD, staging |
| 2   | Kimlik, tenant ve yetkilendirme       |    2-3 hafta | Workspace/brand/RBAC/audit                 |
| 3   | Connector ve veri ingestion platformu |      3 hafta | OAuth vault, queue, raw/canonical pipeline |
| 4   | Google entegrasyonları                |    4-5 hafta | Ads + Search Console + GA4                 |
| 5   | Metrik katmanı ve dashboard           |      3 hafta | Birleşik analiz ekranları                  |
| 6   | Kampanya ve UTM yönetimi              |      2 hafta | Kampanya merkezli ilişkilendirme           |
| 7   | İçerik ve medya iş akışı              |      3 hafta | Takvim, varyant, onay, publish engine      |
| 8   | Meta Ads ve IG/FB yayınlama           |      4 hafta | Meta rapor + sosyal yayın                  |
| 9   | P1 kanal entegrasyonları              |    5-6 hafta | LinkedIn, TikTok, YouTube, GBP             |
| 10  | Raporlama ve müşteri portalı          |      3 hafta | White-label rapor/PDF/CSV                  |
| 11  | Uyarı ve açıklanabilir AI             |      3 hafta | İçgörü, kanıt, kullanıcı onaylı aksiyon    |
| 12  | Gelen kutusu ve otomasyon             |      3 hafta | Desteklenen kanallarda etkileşim yönetimi  |
| 13  | Faturalama ve operasyon paneli        |      2 hafta | Paket, kota, destek araçları               |
| 14  | Production hardening                  |      4 hafta | Güvenlik, yük, DR, uyumluluk               |
| 15  | Pilot, canary ve genel erişim         |      3 hafta | Production v1.0                            |

Tamamen sıralı süre 45 haftaya yaklaşır. 5-6 kişilik ekip ve paralel frontend/connector/platform akışlarıyla hedef **30-36 takvim haftasıdır**. Platform onayları bu tahminden bağımsız dış kritik yoldur.

## 6. Faz 0 — Mimari kararlar ve ürün kontratı

Süre: 1 hafta

### Kod ve belge teslimleri

- `docs/adr/0001-monorepo.md`
- `docs/adr/0002-modular-monolith.md`
- `docs/adr/0003-multitenancy.md`
- `docs/adr/0004-oauth-token-storage.md`
- `docs/adr/0005-metric-semantics.md`
- `docs/adr/0006-nextjs-api-boundary.md`
- `docs/api/error-model.md`
- İlk 30 metrik için makine tarafından okunabilir metric registry taslağı
- Connector capability sözleşmesi taslağı
- Tenant, marka, rol ve izin matrisi

### Kararlar

- Hosting bölgesi ve sağlayıcı
- OIDC/oturum sağlayıcısı
- E-posta ve ödeme sağlayıcısı
- KMS/secrets altyapısı
- Production Google/Meta uygulama sahipliği
- Saklama süreleri ve silme SLA'ları

### Çıkış kapısı

- Ürün, backend, web, güvenlik ve veri sorumlularının ADR onayı
- P0 OAuth scope listesinin kesinleşmesi
- Production ile staging'in ayrı cloud projeleri/hesapları olarak tasarlanması

## 7. Faz 1 — Monorepo ve delivery altyapısı

Süre: 2 hafta

### Repository işleri

- Bun workspace ve Turborepo uyumlu görev yapısı
- `apps/web`, `apps/api`, `apps/worker`, `apps/admin` iskeletleri
- Ortak TypeScript, ESLint ve format ayarları
- `packages/config`, `contracts`, `observability`, `testkit`, `ui`
- Dockerfile ve local compose: PostgreSQL, Redis, S3 emulator
- `.env.example`; gerçek secret içermeyen local kurulum
- Dev container isteğe bağlı

### Next.js web işleri

- App Router route grupları
- Public/auth/dashboard layout'ları
- Temel metadata, error, loading ve not-found sınırları
- Server/Client Component kullanım kuralları
- Tema, tipografi, erişilebilir UI çekirdeği
- `instrumentation.ts` ile OpenTelemetry başlangıcı
- Health/build bilgisi endpoint'i
- API client wrapper ve request correlation ID

### CI/CD işleri

- PR kalite workflow'u
- Main branch staging deploy
- Container image SBOM ve imza
- Migration job'u uygulamadan ayrı
- Preview environment yalnız güvenli/sentetik veriyle
- Release artifact'larının immutable olması

### Testler

- Her uygulama için build smoke testi
- Örnek API route integration testi
- Örnek Next.js sayfası Playwright testi
- Config eksik/hatalı olduğunda fail-fast testi

### Çıkış kapısı

- Tek komutla local ortam
- Main'e merge sonrası otomatik staging
- Web, API, worker için trace ve yapılandırılmış log
- Secret taramasının aktif olması

## 8. Faz 2 — Kimlik, tenant ve yetkilendirme

Süre: 2-3 hafta

### Migration sırası

1. `users`, `accounts`, `sessions`
2. `workspaces`, `workspace_members`
3. `clients`, `brands`, `brand_members`
4. `roles`, `permissions`, `role_permissions`
5. `invitations`
6. `audit_events`
7. RLS policy'leri ve tenant context fonksiyonları

### API modülleri

- `POST /v1/workspaces`
- `GET /v1/workspaces`
- `POST /v1/workspaces/:id/invitations`
- `PATCH /v1/workspaces/:id/members/:memberId`
- `POST /v1/workspaces/:id/clients`
- `POST /v1/workspaces/:id/brands`
- `GET /v1/workspaces/:id/audit-events`

### Next.js ekranları

- Giriş, çıkış, callback ve oturum hatası
- Workspace oluşturma/seçme
- Müşteri ve marka listesi
- Üye daveti ve rol yönetimi
- Güvenlik ve aktif oturumlar
- Audit log görünümü

### Güvenlik işleri

- HTTP-only, secure, same-site session cookie
- CSRF ve origin kontrolü
- MFA hazırlığı
- Veri erişim katmanında workspace permission guard
- DTO allowlist; ORM modelini doğrudan response yapmama
- IDOR/tenant escape test paketi
- Davet token'larında süre, tek kullanım ve hash saklama

### Çıkış kapısı

- Bir workspace kullanıcısının başka tenant verisini hiçbir endpoint'ten okuyamaması
- Rol değişikliklerinin anında etkili olması
- Bütün yönetim aksiyonlarının audit log'a yazılması
- Yetki matrisi integration testlerinin eksiksiz geçmesi

## 9. Faz 3 — Connector ve ingestion platformu

Süre: 3 hafta

### Migration sırası

1. `connections`
2. `connection_credentials`
3. `connection_scopes`
4. `external_accounts`
5. `sync_jobs`, `sync_attempts`, `sync_cursors`
6. `raw_objects`
7. `webhook_events`
8. `dead_letter_jobs`

### Connector SDK

```ts
interface Connector {
  manifest(): ConnectorManifest;
  buildAuthorizationUrl(input: AuthInput): Promise<AuthUrl>;
  exchangeCode(input: CallbackInput): Promise<EncryptedCredential>;
  refreshCredential(input: RefreshInput): Promise<EncryptedCredential>;
  discoverAssets(ctx: ConnectorContext): Promise<ExternalAsset[]>;
  backfill(request: SyncRequest): AsyncIterable<RawBatch>;
  incrementalSync(request: SyncRequest): AsyncIterable<RawBatch>;
  normalize(batch: RawBatch): Promise<CanonicalBatch>;
  health(ctx: ConnectorContext): Promise<ConnectionHealth>;
}
```

Yazma/yayınlama destekleyen connector'lar ayrı `PublisherConnector` arayüzünü uygular. Okuma connector'ına zorunlu yazma metotları eklenmez.

### Ortak servisler

- OAuth state + PKCE doğrulama
- KMS destekli credential encryption
- Token refresh kilidi; aynı token'ın eşzamanlı yenilenmesini engelleme
- Durable job payload ve şema sürümleme
- Rate-limit bütçesi
- Exponential backoff + jitter
- Dead-letter ve kontrollü replay
- Raw payload checksum ve object storage
- Cursor yalnız commit sonrası ilerleme
- Connection health state machine

### Next.js ekranları

- Entegrasyon kataloğu
- Bağlanma sihirbazı
- Harici hesap/varlık seçimi
- Scope açıklaması
- Backfill ilerlemesi
- Bağlantı sağlığı ve yeniden yetkilendirme

### Testler

- Sahte OAuth provider
- Token refresh yarış koşulu
- Rate-limit ve geçici 5xx
- Duplicate webhook
- Worker çöküşü sonrası devam
- Kısmi batch yazımında cursor ilerlememesi
- Credential/log redaction

### Çıkış kapısı

- Örnek connector ile uçtan uca OAuth → asset → backfill → normalize
- Job tekrar çalıştığında duplicate veri oluşmaması
- Token'ların log, trace, hata sistemi ve DB dump'ta düz metin görünmemesi

## 10. Faz 4 — Google entegrasyonları

Süre: 4-5 hafta

### Google ortak kimlik katmanı

- Minimum scope yaklaşımı
- Tek OAuth bağlantısından yetkili servisleri belirleme
- Google customer/property/site varlık keşfi
- İptal/revoke ve yeniden yetkilendirme
- Production/test Google Cloud projelerini ayırma

### Search Console connector

- Site/property keşfi
- `date`, `query`, `page`, `country`, `device`, `searchAppearance` kırılımları
- Günlük incremental sync
- Son günlerde incomplete/fresh data işareti
- 25.000 satır pagination ve kontrollü sorgu parçalama
- Pahalı page+query sorguları için kota bütçesi
- API'nin tüm satırları garanti etmediğine dair metadata

### Google Ads connector

- Manager/client account hiyerarşisi
- Campaign, ad group, ad ve keyword temel boyutları
- Cost, impression, click, conversion, conversion value metrikleri
- Currency ve account time zone
- GAQL query builder; allowlist'li alanlar
- Son 30 günü yeniden çekerek gecikmeli conversion düzeltmesi
- İlk sürüm salt-okunur

### GA4 connector

- Property keşfi
- Metadata ile desteklenen dimension/metric kontrolü
- `runReport` ve gerektiğinde batch rapor
- Traffic acquisition, landing page, key event ve revenue veri setleri
- Sampling/threshold/data freshness metadata
- Custom dimension seçimi için kullanıcı arayüzü sonraki iterasyon

### Kanonik tablolar

- `external_entities`
- `metric_facts_daily`
- `metric_facts_hourly`
- `dimension_dictionary`
- `currency_rates`
- `data_quality_flags`
- `sync_watermarks`

### Test ve uzlaştırma

- Her servis için kaydedilmiş fixture'larla contract test
- 5 gerçek pilot hesabında platform UI karşılaştırması
- Para birimi ve saat dilimi sınır testleri
- Eksik/örneklenmiş verinin UI'da görünmesi
- Büyük backfill performans testi

### Çıkış kapısı

- Beş pilot markada günlük verinin doğru ve tekrarlanabilir çekilmesi
- Kaynak UI ile açıklanamayan kritik fark bulunmaması
- API hatasında mevcut dashboard'ın kaybolmaması
- Google Ads developer erişiminin production kullanıma uygun olması

## 11. Faz 5 — Metrik katmanı ve Next.js dashboard

Süre: 3 hafta

### Metrics paketi

- Metrik registry: anahtar, ad, açıklama, birim, kaynak, formül, versiyon
- Toplanabilir/toplanamaz metrik işareti
- Derived metric hesaplayıcı
- Dönem karşılaştırma servisi
- Veri tazeliği ve kalite durumu
- Attribution pencere metadata'sı
- Ortak filter AST ve SQL derleyici

### API

- `GET /v1/brands/:brandId/overview`
- `POST /v1/analytics/query`
- `GET /v1/metrics/definitions`
- `GET /v1/brands/:brandId/data-health`
- `GET /v1/brands/:brandId/connections/health`

### Next.js route'ları

```text
/(dashboard)/[workspaceSlug]/overview
/(dashboard)/[workspaceSlug]/brands/[brandId]/overview
/(dashboard)/[workspaceSlug]/brands/[brandId]/ads
/(dashboard)/[workspaceSlug]/brands/[brandId]/seo
/(dashboard)/[workspaceSlug]/brands/[brandId]/analytics
/(dashboard)/[workspaceSlug]/brands/[brandId]/data-health
```

### Web uygulama kuralları

- İlk ekranlar Server Component; etkileşimli grafik/filtreler Client Component adası
- URL, aktif filtrelerin kaynağıdır; paylaşılabilir görünüm
- Server-side permission check veri kaynağına yakın yapılır
- Skeleton, empty, stale, partial ve error durumları ayrı tasarlanır
- Tarih/saat/para formatları locale-aware
- Tablo görünümleri klavye ve ekran okuyucu uyumlu
- Grafiklerde tablo alternatifi

### Çıkış kapısı

- Dashboard Core Web Vitals bütçesi içinde
- İlk anlamlı rapor sorgusu hedefi p95 < 2 saniye
- Her metrik kartında kaynak, tanım ve son güncelleme
- Async Server Component yolları Playwright ile test edilmiş

## 12. Faz 6 — Kampanya ve UTM yönetimi

Süre: 2 hafta

### Migration

- `campaigns`, `campaign_goals`
- `campaign_assets`
- `utm_templates`, `utm_links`
- `naming_rules`
- `tasks`, `comments`

### Domain kuralları

- Kampanya lifecycle: draft → active → completed → archived
- Kanal varlıklarını tek kampanyaya bağlama
- Hedef ve bütçe zaman aralığı
- UTM standardı ve duplicate URL kontrolü
- Kampanya sahibini ve aksiyon geçmişini tutma

### Next.js ekranları

- Kampanya listesi ve detay
- Kampanya oluşturma sihirbazı
- Hedef/bütçe/tarih
- Varlık eşleme
- UTM oluşturucu
- Kampanya birleşik performans görünümü

### Çıkış kapısı

- En az bir Google Ads kampanyası, Search Console sayfası ve GA4 dönüşümü aynı kampanya raporunda
- UTM kuralları backend'de doğrulanıyor
- Kampanya değişiklikleri audit log'da

## 13. Faz 7 — İçerik, medya, onay ve publish engine

Süre: 3 hafta

### Migration

- `content_items`, `content_variants`
- `media_assets`, `media_derivatives`
- `approval_workflows`, `approval_steps`, `approval_decisions`
- `publish_jobs`, `publish_attempts`, `external_posts`
- `content_labels`, `content_label_links`

### Media pipeline

- Presigned multipart upload
- MIME magic-byte doğrulama
- Virüs/malware tarama
- Image/video metadata çıkarma
- Platform capability kurallarına göre doğrulama
- Thumbnail ve güvenli preview türetme
- Lifecycle ve orphan cleanup

### Publish engine

- Platform ve içerik türü capability matrisi
- Kullanıcı saat diliminden UTC schedule dönüşümü
- Yayın saatinden önce hazırlık/validasyon işi
- At-most-once dış yayın hedefi; uygulama içinde güvenli retry
- Idempotency ve external post ID kaydı
- İptal, yeniden zamanlama ve hata çözüm akışı
- Platform hatasını kullanıcı diline çevirme

### Next.js ekranları

- Aylık/haftalık takvim
- İçerik editörü
- Kanal varyantları
- Platform preview
- Medya kütüphanesi
- Onay kuyruğu
- Yayın hataları ve yeniden deneme

### Çıkış kapısı

- Fake publisher ile 10.000 planlı iş yük testi
- DST geçişlerinde zamanlama testleri
- Duplicate yayın senaryosunun engellenmesi
- Yetkisiz kullanıcının onay/yayın yapamaması

## 14. Faz 8 — Meta Ads ve Instagram/Facebook

Süre: 4 hafta

### Meta connector

- Business, ad account, Page ve Instagram account keşfi
- Meta Ads campaign/ad set/ad performansı
- Currency/time zone ve attribution metadata
- Token expiration ve permission değişikliği yönetimi
- Webhook doğrulama ve event deduplication

### Yayınlama

- Desteklenen feed image/video
- Reels ve carousel; API capability doğrulamasına göre
- Caption, alt text ve desteklenen alanlar
- Container oluşturma → durum izleme → publish akışı
- External post URL/ID ve sonuç senkronu

### Kalite kapıları

- Meta app review için demo akışları ve test kullanıcıları
- Gerçek profesyonel hesaplarda yayın testi
- İptal edilmiş token ve kaldırılmış Page rolü testi
- Platform oran/kota limitlerinin UI'da önceden gösterilmesi
- En az 100 kontrollü gönderide hedeflenen yayın başarısı

## 15. Faz 9 — LinkedIn, TikTok, YouTube ve GBP

Süre: 5-6 hafta

Bu fazda ekip iki connector hattına ayrılabilir; ortak SDK ve publish engine tamamlanmadan başlanmaz.

### LinkedIn

- Organization keşfi ve rol kontrolü
- Text/image/video/document için capability bazlı yayın
- Post analytics
- API version header merkezi yönetimi
- Kısıtlı izin yoksa özelliği gizleme

### TikTok

- Creator info sorgusu
- Video/photo uygunluk doğrulama
- Direct Post ve draft upload akışlarını ayrı sunma
- PULL_FROM_URL için domain doğrulama
- Publish status polling
- Denetlenmemiş uygulama kısıtlarını açıkça gösterme

### YouTube

- Channel keşfi
- Resumable video upload
- Video/Shorts metadata ve zamanlama
- Analytics connector
- Günlük kota maliyeti bütçeleme

### Google Business Profile

- Account/location keşfi
- Lokasyon performansı
- Local Post
- Review listeleme ve destekleniyorsa yanıtlama
- Pub/Sub notification consumer
- Sandbox olmadığı için `validateOnly` ve özel test lokasyonu yaklaşımı

### Çıkış kapısı

- Her connector için manifest, fixture, contract test ve runbook
- Platform erişimi olmayan yeteneğin UI'da vaat edilmemesi
- Her dış write işleminin kullanıcı onayı ve audit kaydı
- Connector bazlı kill switch

## 16. Faz 10 — Raporlama ve müşteri portalı

Süre: 3 hafta

### Migration

- `report_templates`, `reports`, `report_widgets`
- `report_snapshots`, `report_exports`
- `shared_links`, `scheduled_deliveries`
- `brand_themes`

### Backend/worker

- Versiyonlu report schema
- Widget query compiler
- Sabit snapshot üretimi
- PDF renderer worker
- CSV export worker
- Zamanlanmış e-posta
- Tahmin edilemeyen token'lı, süreli paylaşım linki
- Download authorization ve rate limit

### Next.js

- Rapor editörü
- Şablon galerisi
- Marka teması
- Preview ve snapshot geçmişi
- Paylaşım ve zamanlama
- Salt-okunur müşteri portalı

### Çıkış kapısı

- Eski rapor snapshot'ı metrik tanımı değişince değişmiyor
- Büyük raporlar web request timeout'una bağlı değil
- Paylaşım linkleri tenant erişimini aşmıyor
- PDF ve web görünümü temel sayısal olarak eşleşiyor

## 17. Faz 11 — Uyarılar ve açıklanabilir AI

Süre: 3 hafta

### Migration

- `alert_rules`, `alert_events`
- `insights`, `insight_evidence`
- `recommendations`, `recommended_actions`
- `action_approvals`, `action_executions`, `action_outcomes`
- `ai_runs`, `ai_evaluations`

### Deterministik analiz

- Bütçe pacing
- Dönüşüm maliyeti sapması
- ROAS düşüşü
- Search Console yüksek gösterim/düşük CTR fırsatı
- Veri kesintisi ve tracking anomalisi
- Dönem karşılaştırma ve istatistiksel eşik

### AI katmanı

- Sağlayıcıdan bağımsız model arayüzü
- JSON schema zorunlu çıktı
- Sadece yetkili, minimize edilmiş bağlam
- Metrik evidence ID'leri
- Prompt/model versiyonlama
- Türkçe/İngilizce değerlendirme seti
- PII/token redaction
- Tenant ve paket bazlı kullanım bütçesi

### Aksiyon güvenliği

- AI yalnız öneri oluşturur.
- Kullanıcı öneriyi göreve çevirebilir.
- Dış sistem değişikliği ayrı açık onay ister.
- Execution servisi izin, güncel bağlantı ve limitleri tekrar kontrol eder.
- Sonuç daha sonra ölçülerek recommendation ile ilişkilendirilir.

### Çıkış kapısı

- Her AI içgörüsünde kanıt ve dönem
- Yetkisiz/verisiz marka hakkında çıktı üretilemiyor
- Otomatik değerlendirmede kritik uydurma oranı kabul eşiğinin altında
- Model servisi kapalıyken temel dashboard ve deterministik uyarılar çalışıyor

## 18. Faz 12 — Gelen kutusu ve otomasyon

Süre: 3 hafta

### Kapsam

- Platform desteklediği ölçüde yorum, mention, mesaj ve GBP review
- Atama, durum, iç not, etiket ve SLA
- Hazır yanıt
- Webhook + polling hibrit senkron
- Otomasyon kuralları: koşul → kullanıcı onaylı/güvenli eylem
- Spam/duygu sınıflandırması

### Migration

- `inbox_threads`, `inbox_messages`
- `contacts`, `contact_identities`
- `assignments`, `sla_events`
- `automation_rules`, `automation_runs`

### Güvenlik

- Mesaj içeriğini AI'ya göndermeden önce kapsam ve veri politikası kontrolü
- Zararlı bağlantı/HTML sanitization
- Hazır yanıt ve dış mesajın audit kaydı
- Bulk action limiti

### Çıkış kapısı

- Duplicate webhook aynı mesajı tekrar oluşturmuyor
- Bir müşteri konuşması başka markada görünmüyor
- SLA job'ları worker yeniden başlasa da kaybolmuyor

## 19. Faz 13 — Faturalama ve iç operasyon paneli

Süre: 2 hafta

### Billing

- Plan, abonelik ve entitlement modeli
- Marka, bağlantı, depolama, rapor ve AI kullanım sayaçları
- Checkout ve müşteri portalı
- Webhook signature ve event idempotency
- Trial, grace period, failed payment ve downgrade kuralları
- Fatura/ödeme sağlayıcı verisini minimum saklama

### Admin Next.js uygulaması

- Workspace ve bağlantı sağlık arama
- PII maskeleme
- Kullanıcı adına işlem yapmadan tanı koyma
- Gerekçeli, süreli break-glass erişim
- Job retry/replay
- Feature flag ve connector kill switch
- Kota ve maliyet görünümü
- Support action audit log

### Çıkış kapısı

- Entitlement kontrolü hem UI hem API'de
- Duplicate payment webhook çift faturalama oluşturmuyor
- Support personeli secret/token göremiyor
- Abonelik sonlanması veri silmeden önce tanımlı retention akışına giriyor

## 20. Faz 14 — Production hardening

Süre: 4 hafta

### Güvenlik

- Threat model güncelleme
- Tenant isolation dış güvenlik testi
- OAuth ve webhook saldırı senaryoları
- SAST, DAST, dependency ve container taraması
- CSP, HSTS ve güvenlik header'ları
- Rate limit, WAF ve reverse proxy limitleri
- Secret rotasyon tatbikatı
- Admin MFA/passkey zorunluluğu
- Audit log bütünlüğü

### Performans ve ölçek

- Gerçekçi 10x beklenen beta yükü
- Sync queue, publish spike ve PDF rendering load testleri
- PostgreSQL slow query bütçesi ve index analizi
- Connection pool sınırları
- Next.js bundle analizi
- CDN/cache davranışı
- Çok instance dağıtımında shared cache/tag coordination
- Rolling deploy sırasında Next.js deployment ID ve tutarlı Server Action encryption key

### Dayanıklılık ve DR

- Multi-AZ yönetilen PostgreSQL
- Point-in-time recovery
- Şifreli cross-region/cross-account yedek değerlendirmesi
- Restore tatbikatı
- Redis kaybında durable işlerin davranışı
- Dış API kesintisi chaos testi
- RPO hedefi: 15 dakika
- RTO hedefi: 2 saat
- Manual failover runbook

### Uyumluluk

- Veri envanteri
- DPA ve alt işleyen listesi
- Saklama ve otomatik silme job'ları
- Workspace export/delete
- OAuth revoke + credential deletion
- KVKK ilgili kişi talep akışı
- Yurt dışı aktarım belgeleri ve kayıtları
- Açık rıza gerekiyorsa aydınlatmadan ayrı akış

### SLO ve alert

- API aylık kullanılabilirlik: %99,9
- Publish işinin zamanında kuyruğa alınması: %99,95
- Günlük performans verisinin hedef tazeliği: 6 saat
- Kritik entegrasyon hatası algılama: 10 dakika
- Error budget dashboard
- Seviyeli pager ve escalation politikası

### Çıkış kapısı

- Kritik/yüksek güvenlik açığı yok
- Yedekten production benzeri ortama başarılı restore
- Yük testinde SLO karşılanıyor
- Veri silme ve export uçtan uca doğrulanmış
- Olay müdahale ve rollback tatbikatı tamamlanmış

## 21. Faz 15 — Pilot, canary ve genel erişim

Süre: 3 hafta

### Yayın sırası

1. İç ekip production smoke testi
2. 3 tasarım ortağına feature flag
3. 10 workspace'e canary
4. 20-50 ücretli müşteriye kontrollü erişim
5. Error budget ve destek yükü uygunsa genel erişim

### Deployment stratejisi

- Immutable container image
- Önce geriye uyumlu migration
- Web/API/worker canary
- Health + readiness + dependency checks
- Otomatik smoke test
- Hata oranı/SLO eşiklerinde otomatik rollout durdurma
- Rollback uygulama image'ında; migration için forward-fix/expand-contract
- Connector'lar bağımsız feature flag ve kill switch ile açılır

### Production readiness review

- Sahiplik ve on-call çizelgesi
- Runbook'lar
- Status page
- Destek ve güvenlik iletişim adresleri
- Platform app review durumları
- Faturalama ve iptal akışları
- Veri saklama/silme doğrulaması
- Dashboard veri uzlaştırması
- SLO ve alarm testleri
- Yedek/restore kanıtı
- Hukuki belgelerin yayında olması

### Genel erişim kriterleri

- En az dört hafta kritik SLO uyumu
- Kritik/yüksek güvenlik açığı yok
- P0 entegrasyonlarda %98+ günlük sync başarısı
- Kontrollü sosyal yayınlarda %99+ platformca kabul oranı; kullanıcı kaynaklı validasyon hataları hariç
- İlk değer süresi medyanı 15 dakikanın altında
- Destek ekibinin bağlantı ve job sorunlarını admin panelinden teşhis edebilmesi
- En az 10 ödeme yapan müşteri ve doğrulanmış retention sinyali

## 22. Veritabanı migration stratejisi

Kurallar:

- Migration dosyaları immutable'dır; uygulanmış dosya değiştirilmez.
- Her migration staging production benzeri veri hacminde ölçülür.
- Uzun süren index işlemleri çevrimiçi/concurrent yaklaşım kullanır.
- Kolon silme aynı release içinde yapılmaz.
- Yeni kolon önce nullable/default güvenli eklenir, data backfill worker ile doldurulur, sonra constraint uygulanır.
- Uygulama eski ve yeni şemayla en az bir rollout boyunca çalışabilir.
- Tenant/RLS değişiklikleri özel güvenlik testinden geçer.
- Analytics backfill uygulama migration'ından ayrı job olarak yürür.

Önerilen migration fazları:

```text
001-019 platform ve auth
020-039 connections ve jobs
040-069 canonical metrics
070-089 campaign/content
090-109 publishing
110-129 reports
130-149 alerts/ai
150-169 inbox
170-189 billing/compliance
```

## 23. API tasarım planı

### Standartlar

- `/v1` sürüm öneki
- JSON request/response
- RFC 9457 problem details uyumlu hata gövdesi
- `request_id` ve gerektiğinde `idempotency_key`
- Cursor pagination
- ETag/conditional request uygun okumalarda
- Webhook'larda imza, timestamp ve replay kontrolü
- OpenAPI'den üretilmiş web istemcisi
- Breaking değişiklik CI kontrolü

### Modül grupları

```text
/v1/auth/*
/v1/workspaces/*
/v1/clients/*
/v1/brands/*
/v1/connections/*
/v1/sync-jobs/*
/v1/analytics/*
/v1/campaigns/*
/v1/content/*
/v1/publish-jobs/*
/v1/reports/*
/v1/alerts/*
/v1/insights/*
/v1/inbox/*
/v1/billing/*
/v1/admin/*
/webhooks/google/*
/webhooks/meta/*
/webhooks/linkedin/*
/webhooks/tiktok/*
/webhooks/youtube/*
/webhooks/billing/*
```

Public API, v1.0 sonrasında ayrı OAuth client ve kota modeliyle açılmalıdır; dahili cookie/session API'si public API diye sunulmamalıdır.

## 24. Next.js uygulama planı

### Route ağacı

```text
app/
  (public)/
    page.tsx
    pricing/page.tsx
    security/page.tsx
    privacy/page.tsx
    terms/page.tsx
    status/page.tsx
  (auth)/
    login/page.tsx
    callback/page.tsx
  (onboarding)/
    onboarding/workspace/page.tsx
    onboarding/brand/page.tsx
    onboarding/integrations/page.tsx
    onboarding/import/page.tsx
  (dashboard)/
    [workspaceSlug]/
      layout.tsx
      page.tsx
      campaigns/
      calendar/
      ads/
      seo/
      analytics/
      reports/
      inbox/
      automations/
      integrations/
      settings/
  share/reports/[token]/page.tsx
```

### Rendering kararları

- Marketing sayfaları static/ISR olabilir.
- Dashboard her istekte güvenli session ve permission kontrolü yapar.
- Hassas dashboard HTML'i paylaşılan CDN cache'ine girmez.
- İlk veri Server Component üzerinden alınır.
- Grafik, editor, takvim ve sürükle-bırak etkileşimleri Client Component'tir.
- Mutation'lar API/domain sınırından geçer; Server Action kullanılsa bile permission ve input doğrulama tekrar edilir.
- Route layout yalnız optimistik yönlendirme sağlar; güvenli authorization DAL/API'de yapılır.

### State yönetimi

- URL: filtre, tarih, sekme ve paylaşılabilir durum
- Server state: API client + kontrollü cache/revalidation
- Form state: form kütüphanesi + Zod schema
- Global client store yalnız gerçek UI state için
- Websocket/SSE yalnız senkron ve publish ilerlemesi gibi canlı olaylarda

### Tasarım sistemi

- Token'lar: renk, spacing, typography, radius, elevation
- Dark/light mode
- WCAG 2.2 AA hedefi
- Grafik renklerinde renk körlüğü güvenliği
- Table, filter bar, metric card, chart, status badge, data freshness ortak primitive'leri
- Storybook veya eşdeğeri izole bileşen kataloğu

### Next.js production özel kontrolleri

- `instrumentation.ts` ve `onRequestError`
- Standalone Docker output
- Reverse proxy/WAF önünde çalıştırma
- Payload ve upload sınırları
- Çok instance için tutarlı Server Action encryption key
- Deployment ID ile sürüm kayması koruması
- Shared cache ve tag invalidation koordinasyonu
- Bundle analyzer ve image optimization belleği
- Security headers ve CSP nonce yaklaşımı

## 25. Test piramidi ve hedefler

### Unit

- Domain ve metrik paketlerinde yüksek kapsam
- Para, tarih, zaman dilimi, attribution ve state machine testleri
- Connector normalizer'ları
- Permission policy'leri

Hedef: domain, metrics ve security paketlerinde satır kapsamı en az %90; bütün repo için kör bir yüzde yerine risk bazlı kapı.

### Integration

- Gerçek PostgreSQL ve Redis
- RLS/tenant isolation
- API endpoint + DB
- Queue producer/consumer
- OAuth callback ve token refresh
- Migration up testi

### Contract

- Platform API fixture'ları
- Provider response şema değişikliği
- OpenAPI istemci uyumu
- Webhook signature/replay

### E2E

- Kayıt → workspace → marka → Google bağlantısı → dashboard
- İçerik → onay → zamanlama → fake/gerçek sandbox publish
- Rapor → snapshot → PDF → paylaşım
- Abonelik → entitlement
- Export/delete
- Rol ve tenant negatif testleri

### Non-functional

- Load ve soak
- Accessibility
- Visual regression
- Chaos/fault injection
- Backup restore
- DAST ve penetration test

Flaky test karantinaya alınıp unutulmaz; sahibi ve düzeltme tarihi olmadan merge kapısından çıkarılamaz.

## 26. Ortam ve dağıtım topolojisi

Ortamlar:

- Local: sentetik fixture ve emülatörler
- Development: ekip entegrasyonu
- Staging: production benzeri, ayrı OAuth projeleri
- Production: gerçek müşteri verisi

Production servisleri:

- Next.js web: yatay ölçeklenebilir
- Fastify API: yatay ölçeklenebilir
- Sync worker pool: connector/kota bazlı ölçek
- Publish worker pool: yüksek öncelik, sync'ten ayrı
- Report/media worker pool: CPU/memory sınırları ayrı
- Scheduler/leader: singleton veya distributed lock
- PostgreSQL: HA/PITR
- Redis: yönetilen HA
- Object storage + CDN
- OpenTelemetry collector

Production verisi development veya preview ortamına kopyalanmaz. Gerekirse geri döndürülemez anonimleştirme pipeline'ı ayrı onayla kullanılır.

## 27. Operasyon runbook listesi

Canlıya çıkmadan bulunması gereken runbook'lar:

- Google/Meta token toplu iptali
- Connector rate-limit/kota aşımı
- Publish kuyruğu gecikmesi
- Duplicate yayın şüphesi
- Veri tutarsızlığı ve yeniden backfill
- Platform API kesintisi
- PostgreSQL failover/restore
- Redis kaybı
- KMS/secret rotasyonu
- Tenant veri erişim olayı
- Kullanıcı export/delete talebi
- Hatalı release rollback
- Hatalı migration forward-fix
- Faturalama webhook kesintisi
- AI sağlayıcı kesintisi ve kill switch

Her runbook; belirti, alarm, etki, ilk 15 dakika, teşhis sorguları, güvenli düzeltme, iletişim ve kapanış kontrolü içerir.

## 28. Ekip çalışma düzeni

Önerilen ekip:

- 1 teknik lider/backend
- 1 connector/data backend mühendisi
- 1 ikinci backend/platform mühendisi
- 1 Next.js frontend mühendisi
- 1 full-stack frontend mühendisi
- 1 ürün tasarımcısı
- Paylaşımlı QA automation
- Paylaşımlı DevOps/SRE
- Dönemsel güvenlik ve KVKK/GDPR uzmanı

Paralel akışlar:

- Hat A: platform, auth, DB, queue, observability
- Hat B: connector'lar ve veri normalizasyonu
- Hat C: Next.js dashboard, takvim, rapor ve portal
- Hat D: test otomasyonu, güvenlik, infra ve release

Haftalık ritim:

- Pazartesi: risk/bağımlılık ve platform onayı kontrolü
- Günlük: kısa teknik senkron
- Haftada iki: connector veri uzlaştırması
- Cuma: staging demo, SLO ve pilot geri bildirimi
- Her faz sonu: exit gate; eksik kritik maddeyle sonraki faz “tamamlandı” sayılmaz

## 29. İlk üç sprintin dosya seviyesinde planı

### Sprint 1 — Çalışan iskelet

Oluşturulacaklar:

```text
package.json
bun.lock
turbo.json
tsconfig.base.json
apps/web/package.json
apps/web/src/app/layout.tsx
apps/web/src/app/page.tsx
apps/web/src/app/api/health/route.ts
apps/web/src/instrumentation.ts
apps/api/package.json
apps/api/src/server.ts
apps/api/src/plugins/config.ts
apps/api/src/plugins/observability.ts
apps/api/src/modules/health/routes.ts
apps/worker/package.json
apps/worker/src/worker.ts
packages/config/src/index.ts
packages/contracts/src/health.ts
packages/observability/src/index.ts
packages/ui/src/index.ts
infra/docker/compose.yaml
.github/workflows/ci.yaml
```

Sprint sonucu: Local ve staging'de web → API bağlantısı, health check, trace ve CI build.

### Sprint 2 — Tenant çekirdeği

Oluşturulacaklar:

```text
packages/db/src/schema/auth.ts
packages/db/src/schema/workspaces.ts
packages/db/src/schema/brands.ts
packages/db/src/schema/audit.ts
packages/db/src/migrations/*
packages/auth/src/session.ts
packages/auth/src/permissions.ts
packages/domain/src/workspaces/*
apps/api/src/modules/workspaces/*
apps/api/src/modules/brands/*
apps/web/src/app/(auth)/*
apps/web/src/app/(dashboard)/[workspaceSlug]/*
apps/web/src/features/workspaces/*
apps/web/src/features/brands/*
```

Sprint sonucu: Giriş, workspace/marka oluşturma, üye daveti, rol ve tenant isolation testleri.

### Sprint 3 — İlk gerçek connector

Oluşturulacaklar:

```text
packages/connectors-core/src/manifest.ts
packages/connectors-core/src/oauth.ts
packages/connectors-core/src/sync.ts
packages/security/src/encryption.ts
packages/jobs/src/sync-jobs.ts
packages/connector-search-console/src/index.ts
packages/connector-search-console/src/auth.ts
packages/connector-search-console/src/discovery.ts
packages/connector-search-console/src/sync.ts
packages/connector-search-console/src/normalize.ts
apps/api/src/modules/connections/*
apps/worker/src/processors/sync.ts
apps/web/src/features/integrations/*
```

Sprint sonucu: Google OAuth → Search Console property seçimi → 90 günlük backfill → veri sağlık ekranı.

## 30. Production v1.0 Definition of Done

Bir özellik yalnız aşağıdakilerin tamamı sağlanıyorsa production-ready sayılır:

- Kabul kriteri karşılandı.
- Permission ve tenant kontrolü var.
- Girdi/çıktı şemaları tipli ve doğrulanıyor.
- Audit gerektiren aksiyon kaydediliyor.
- Loading, empty, partial, stale ve error UI durumları var.
- Unit/integration ve gerekli E2E testleri var.
- Log/trace/metric var; secret ve PII redaction doğrulandı.
- Rate-limit, timeout, retry ve idempotency davranışı tanımlı.
- Migration geriye uyumlu.
- Feature flag/rollback yaklaşımı var.
- Dokümantasyon ve runbook güncel.
- Erişilebilirlik kontrol edildi.
- Ürün analitiği olayı tanımlı.
- Support/admin teşhis görünümü mevcut.

Ürünün tamamı için ayrıca:

- Dış güvenlik testi tamamlanmış
- KVKK/GDPR süreçleri hukuk kontrolünden geçmiş
- OAuth/platform production onayları alınmış
- Yedek geri yükleme kanıtlanmış
- SLO'lar dört hafta pilotta karşılanmış
- Faturalama ve iptal akışı doğrulanmış
- Veri uzlaştırma raporları kabul edilmiş
- On-call ve incident süreci aktif

## 31. İlk uygulama kararı

Kodlamaya başlarken Faz 1 ile Faz 2'nin tamamını bitirip aylarca gerçek API görmemek yerine şu dikey dilim uygulanmalıdır:

1. Minimal monorepo ve CI
2. Minimal workspace/brand/RBAC
3. Connector SDK'nın gereken kısmı
4. Google OAuth
5. Search Console property keşfi
6. Son 90 günlük veri senkronu
7. Next.js üzerinde SEO dashboard
8. Tenant, retry, audit ve veri doğruluğu testleri

Bu dikey dilim ilk 5-6 haftada staging'de çalışmalıdır. Sonraki bütün connector ve dashboard kararları gerçek entegrasyondan alınan sonuçlara göre sağlamlaştırılır.

## 32. Resmî Next.js uygulama notları

- App Router, Server Components ve Suspense tabanlı ana web mimarisidir: [Next.js App Router](https://nextjs.org/docs/app)
- Next.js, authorization kontrolünün veri kaynağına yakın bir DAL içinde yapılmasını ve yalnız route/layout gizlemeye güvenilmemesini önerir: [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication)
- `instrumentation.ts` production telemetry başlangıç noktasıdır: [Next.js instrumentation](https://nextjs.org/docs/app/guides/instrumentation)
- Self-hosted çok instance dağıtımda shared cache, tag coordination, deployment ID ve tutarlı Server Action encryption key dikkate alınmalıdır: [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- Next.js resmi test rehberi unit, integration, component ve E2E ayrımını; async Server Components için E2E ağırlığını açıklar: [Next.js testing](https://nextjs.org/docs/app/guides/testing)
- Production öncesi performans, güvenlik, type safety ve bundle kontrolleri: [Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist)
