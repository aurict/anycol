# Anycol

Anycol; reklam, SEO, web analitiği ve sosyal içerikleri kampanya merkezli bir modelde birleştiren çok kiracılı pazarlama operasyon platformudur. Google Ads, GA4, Search Console, Instagram/Facebook/Meta, TikTok ve YouTube Shorts için OAuth tabanlı salt-okunur veri bağlantıları içerir.

## Hızlı başlangıç

Gereksinimler: Bun 1.3+, Docker ve Docker Compose.

```bash
cp .env.example .env
docker compose -f infra/docker/compose.yaml up -d postgres redis minio
bun install
bun run db:migrate
bun run --cwd apps/api dev
bun run --cwd apps/web dev
```

Web: `http://localhost:3000`  
API health: `http://localhost:4000/health`  
Demo dashboard: `http://localhost:3000/demo/overview`

## Kalite kapısı

```bash
bun run check
```

Tarayıcı smoke testi production build sonrasında `bun run test:e2e`, güncel advisory taraması `bun audit --production` ile çalışır.

## Kanal bağlantıları

Google ve YouTube aynı Google OAuth istemcisini kullanır. Meta için `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`; TikTok için `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` tanımlanmalıdır. Callback adresi sağlayıcı konsolunda `/v1/connections/oauth/callback` olarak kaydedilmelidir. Instagram Insights, Meta Ads ve TikTok/YouTube kullanıcı verileri sağlayıcı uygulama incelemesine ve ilgili hesap izinlerine tabidir.

## Production dağıtımı

Production imajları API, worker, web ve admin için ayrı Dockerfile'lardan üretilir. `infra/docker/compose.production.yaml` yalnız harici PostgreSQL/Redis, gerçek secret'lar, OIDC ve OTLP endpoint sağlandığında render olur. Release tag'leri immutable GHCR imajı, provenance/SBOM ve Cosign imzası üretir. Operasyon sırası için `docs/runbooks/deploy.md` kullanılır.

Tanıtım sitesi ve müşteri uygulamasının canonical adresi `https://anycol.aurict.com` olarak ayarlanmıştır. Production compose varsayılanları web için `anycol.aurict.com`, API için `api.anycol.aurict.com`, operasyon paneli için `admin.anycol.aurict.com` kullanır. DNS kayıtları ve sunucu secret'ları repository dışında sağlanmalıdır; başlangıç şablonu `.env.production.example` dosyasındadır.

## Uygulamalar

- `apps/web`: Next.js müşteri uygulaması
- `apps/admin`: Next.js iç operasyon paneli
- `apps/api`: Fastify REST API
- `apps/worker`: BullMQ sync/publish worker'ları

## Güvenlik notu

Gerçek OAuth, veritabanı ve şifreleme anahtarlarını repository'ye eklemeyin. Production ortamı `DATABASE_URL`, en az 32 karakter `SESSION_SECRET` ve base64 kodlu 32 byte `CREDENTIAL_ENCRYPTION_KEY` olmadan başlamaz. Dış sağlayıcı yazma yetenekleri uygulama onayı ve gerçek sandbox/işletme hesaplarıyla doğrulanmadan açılmamalıdır.

Ayrıntılı kapsam: [Ürün planı](docs/PRODUCT_PLAN_TR.md), [production kod planı](docs/PRODUCTION_CODE_PLAN_TR.md) ve [uygulama/üretime çıkış durumu](docs/IMPLEMENTATION_STATUS_TR.md).
