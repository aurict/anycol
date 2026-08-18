# PostgreSQL geri yükleme runbook

Otomatik şifreli yedek için `scripts/backup-postgres.sh`, yalnız izole hedefe geri yükleme doğrulaması için `scripts/restore-verify.sh` kullanılır. Production kümesinin üzerine doğrudan restore scripti çalışmaz.

1. Olay komutanını ve veri tabanı sorumlusunu ata; yazma trafiğini bakım moduna al.
2. Hedef zamanı ve kullanılacak PITR noktasını iki kişiyle doğrula.
3. Yeni, izole bir veritabanı kümesine geri yükle; mevcut kümeyi üzerine yazma.
4. Migration sürümünü, tenant sayımlarını, audit zincirini ve kritik metrik toplamlarını doğrula.
5. Token tablolarında encryption formatını ve KMS erişimini yalnız sağlık sorgusuyla kontrol et.
6. API ve worker'ları geri yüklenen kümeye canary olarak bağla.
7. Smoke test sonrası trafiği kademeli taşı; eski kümeyi tanımlı saklama süresince salt-okunur tut.
8. RPO/RTO sonucunu ve sapmaları olay raporuna ekle.
