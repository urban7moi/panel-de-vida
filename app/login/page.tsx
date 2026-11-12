import type { Metadata } from "next";

export const metadata: Metadata = { title: "Entrar · Panel de Vida" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <form method="post" action="/api/login" className="card">
        <div className="header-titles">
          <span className="eyebrow">Panel de Vida</span>
          <h1 className="title" style={{ fontSize: 28 }}>Entrar</h1>
        </div>
        <label className="field">
          Contraseña
          <input className="input" type="password" name="password" autoComplete="current-password" required autoFocus />
        </label>
        {error === "config" && (
          <p className="error" role="alert">
            Falta configurar la contraseña: añade APP_PASSWORD en Vercel y vuelve a desplegar.
          </p>
        )}
        {error && error !== "config" && <p className="error" role="alert">Contraseña incorrecta.</p>}
        <button className="btn-primary" type="submit">Entrar</button>
      </form>
    </main>
  );
}
