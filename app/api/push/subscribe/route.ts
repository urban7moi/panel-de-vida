import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/api-auth";
import { cloudConfigured } from "@/lib/store-server";
import { addSubscription, removeSubscription } from "@/lib/push";

export async function POST(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  if (!cloudConfigured()) return NextResponse.json({ error: "Activa primero la copia en la nube." }, { status: 503 });
  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return NextResponse.json({ error: "Suscripción no válida." }, { status: 400 });
  await addSubscription(sub);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  const endpoint = new URL(req.url).searchParams.get("endpoint");
  if (endpoint && cloudConfigured()) await removeSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
