import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/api-auth";
import { mailConfigured, recentMail } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  if (!mailConfigured()) return NextResponse.json({ status: "sin-configurar", mails: [] });
  try {
    const { mails, unreadTotal } = await recentMail();
    return NextResponse.json(
      { status: "ok", mails, unreadTotal },
      { headers: { "cache-control": "private, max-age=60" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Email", msg);
    const auth = /auth|credentials|login|password|AUTHENTICATIONFAILED/i.test(msg);
    return NextResponse.json({
      status: "error",
      error: auth
        ? "El correo no acepta la contraseña. Revisa EMAIL_USER y EMAIL_APP_PASSWORD en Vercel."
        : "No se pudo conectar con tu correo. Prueba en un rato.",
      mails: [],
    });
  }
}
