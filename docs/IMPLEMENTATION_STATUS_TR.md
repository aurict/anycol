# Anycol production uygulama durumu

Son doğrulama: 18 Ağustos 2026

## Dağıtılabilir kapsam

Repository, **Google Ads + Search Console + GA4 salt-okunur pilotu** için production güvenlik ve dağıtım sınırlarına sahiptir. Meta, LinkedIn, TikTok, YouTube, Google Business yayınlama/inbox; ödeme tahsilatı; PDF/e-posta teslimatı ve model destekli aksiyonlar GA değildir ve UI/API seviyesinde fail-closed tutulur.

Bu ayrım önemlidir: dış sağlayıcı onayı veya gerçek hesap olmadan bir capability “tamamlandı” ya da “healthy” gösterilmez.

## Tamamlanan repository işleri

- OIDC authorization-code + PKCE, ID-token issuer/audience/nonce doğrulaması, imzalı kısa ömürlü session cookie ve güvenli logout.
- JWT rolüne ek olarak PostgreSQL workspace membership doğrulaması.
- Non-superuser uygulama rolü, zorunlu RLS context transaction'ları ve CI tenant izolasyon testi.
- Production secret/key formatı, APP_VERSION, OTLP ve ayrı DB rolü için fail-fast config.
- Gerçek PostgreSQL/Redis readiness; erişilemeyen bağımlılıkta HTTP 503.
- Google OAuth state, şifreli credential, asset discovery ve seçili hesap için kontrollü sync kuyruğu.
- Worker credential refresh, connector çağrısı, normalizasyon, idempotent metric upsert ve job/connection durum kaydı.
- Dashboard'un yalnız DB/API metriklerini göstermesi; demo müşteri ve sahte health verilerinin kaldırılması.
- API, worker, web ve admin için non-root/read-only Docker imajları ve healthcheck.
- TLS edge, kapalı backend network ve zorunlu secret interpolation içeren production compose.
- OTLP trace/metric export, yapılandırılmış/redacted log ve deploy/restore/connector runbook'ları.
- Şifreli PostgreSQL backup ve yalnız izole hedefe restore doğrulama scriptleri.
- CI: format, lint, strict typecheck, coverage threshold, unit/integration, Playwright, migration/RLS, dependency/secret/container taraması.
- Release: immutable GHCR digest, provenance, SBOM ve keyless Cosign imzası.

## Son doğrulama kanıtı

- `bun run check`: başarılı.
- 14 test dosyası / 32 test: başarılı.
- Coverage: %81,22 line, %78,41 statement, %81,15 function, %58,44 branch; eşikler geçti.
- Playwright production smoke: 2/2 başarılı; eksik ve sahte session reddedildi.
- `bun audit --production`: zafiyet bulunmadı.
- PostgreSQL 17 migration: başarılı.
- `anycol_app` rolüyle iki tenant arasında RLS izolasyonu: başarılı.
- API, worker, web ve admin Docker build: başarılı.
- Local ve production compose render doğrulaması: başarılı.

## Organizasyon tarafından sağlanması gereken açılış girdileri

1. App/API/admin domainleri, registry ve production compute hesabı.
2. Managed PostgreSQL'de migration rolü, `anycol_app` üyeliğine sahip non-superuser login ve managed Redis.
3. Secret manager üzerinden session/encryption anahtarları; OTLP endpoint ve alarm hedefleri.
4. OIDC client, callback alan adı ve `workspace_id` / `workspace_role` claim mapping'i.
5. Google OAuth client, GA4/Search Console erişimleri ve onaylı Ads developer token.
6. `workspace:provision` ile doğrulanmış ilk owner/workspace/brand.
7. Şifreli backup hedefi, Age recipient/identity ve restore tatbikatı kanıtı.
8. Harici pentest, veri işleme/saklama kararları, pilot başarı ölçütleri ve rollback yetkilisi.

Bu girdiler ve gerçek hesap canary testi tamamlanmadan genel erişim açılmaz. Diğer sosyal sağlayıcıların onayı gelmeden ilgili özellikler etkinleştirilmez.
