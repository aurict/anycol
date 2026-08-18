import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const { returnTo = "/", error } = await searchParams;
  const safeReturnTo =
    returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand centered" href="/">
          <span className="brand-mark">A</span>
          <span>anycol</span>
        </Link>
        <p className="eyebrow">GÜVENLİ GİRİŞ</p>
        <h1>Workspace’inize dönün</h1>
        <p>
          Kuruluşunuzun OIDC kimlik sağlayıcısı üzerinden PKCE korumalı oturum
          açın.
        </p>
        {error ? (
          <p role="alert">Giriş doğrulanamadı. Lütfen tekrar deneyin.</p>
        ) : null}
        <Link
          className="button wide"
          href={`/api/auth/login?returnTo=${encodeURIComponent(safeReturnTo)}`}
        >
          Kurumsal hesapla devam et
        </Link>
        <small>Oturumlar 15 dakika sonra yenilenmek üzere sona erer.</small>
      </section>
    </main>
  );
}
