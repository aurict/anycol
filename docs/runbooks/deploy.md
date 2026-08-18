# Production deployment runbook

1. Release tag'inin CI, migration, RLS, E2E, dependency audit ve dört container taramasından geçtiğini doğrula.
2. GHCR image digest'lerini ve keyless Cosign imzalarını doğrula; mutable tag ile deploy etme.
3. Migration'ı uygulama rolünden ayrı migration rolüyle çalıştır. Önce staging kopyasında süre ve lock ölçümü yap.
4. Production secret store'dan `DATABASE_URL`, `REDIS_URL`, session/encryption anahtarları, OIDC ve OTLP ayarlarını yükle. Uygulama DB kullanıcısının superuser/owner olmadığını doğrula.
5. Yeni API ve worker digest'ini trafiksiz canary olarak başlat; `/ready` DB ve Redis için 200 vermeden trafik açma.
6. Web ve admin'i başlat; OIDC login, sahte cookie reddi, workspace RLS, Google/Meta/TikTok OAuth callback ve küçük tarih aralıklı sync smoke testlerini çalıştır. YouTube için Data API ile Analytics API'nin, Meta için Instagram Graph ve Marketing API izinlerinin, TikTok için Login Kit `video.list` kapsamının onaylı olduğunu doğrula.
7. Trafiği %5 → %25 → %100 artır. 5xx, p95 latency, queue failure/retry, DB saturation ve connector 401/429 oranlarını izle.
8. Eşik aşılırsa önceki immutable digest'e dön; geriye uyumsuz schema contract migration'ını aynı release içinde uygulama.
9. Deploy digest'leri, migration sürümü, doğrulayan kişi, metrik kanıtı ve rollback kararını release kaydına ekle.

## Zorunlu alarmlar

- API veya worker readiness 2 dakika boyunca başarısız.
- Beş dakikada HTTP 5xx oranı %2 üzerinde veya p95 latency 1 saniye üzerinde.
- Sync/publish failed + dead-letter işi artışı.
- PostgreSQL bağlantı havuzu %80 üzerinde, Redis bağlantısı kayıp veya disk baskısı.
- Connector bazında 401/403, 429 ve 5xx oranında ani artış.
- Son başarılı şifreli backup 24 saatten eski veya aylık restore tatbikatı başarısız.
