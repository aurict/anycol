# Connector kesintisi runbook

1. İlgili connector'ın hata oranını ve provider durum sayfasını doğrula.
2. Credential veya kişisel veriyi loglara yazmadan örnek request ID'leri incele.
3. 401/403 ise yalnız etkilenen bağlantıları `reauthorization_required` durumuna al.
4. 429/5xx ise connector circuit breaker'ını aç, yeni backfill'leri durdur ve incremental işleri geciktir.
5. Publish connector etkileniyorsa kullanıcıları zamanlanmış içerikten önce bilgilendir.
6. Sağlayıcı düzeldiğinde küçük canary workspace ile iş akışını doğrula.
7. Dead-letter işleri tenant ve zaman aralığı doğrulandıktan sonra kontrollü replay et.
8. Olay kaydına etki, zaman çizelgesi, kök neden ve kalıcı aksiyonu ekle.
