import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/api-auth";
import { cloudConfigured } from "@/lib/store-server";
import { sendToAll } from "@/lib/push";

export async function POST() {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  if (!cloudConfigured()) return NextResponse.json({ error: "Activa primero la copia en la nube." }, { status: 503 });
  const sent = await sendToAll({ title: "moi.", body: "¡Las notificaciones funcionan!", url: "/" });
  return NextResponse.json({ sent });
}
