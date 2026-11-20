import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/api-auth";
import { icloudConfigured, icloudEvents } from "@/lib/icloud";
import { dayBounds, todayMadrid } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Eventos del Calendario de Apple de un día (?date=AAAA-MM-DD, por defecto hoy). */
export async function GET(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  const date = new URL(req.url).searchParams.get("date") ?? todayMadrid();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Fecha no válida" }, { status: 400 });
  if (!icloudConfigured()) return NextResponse.json({ status: "sin-configurar", events: [] });
  const { start, end } = dayBounds(date);
  const events = await icloudEvents(start, end);
  if (!events) return NextResponse.json({ status: "error", events: [] });
  events.sort((a, b) => a.start.localeCompare(b.start));
  return NextResponse.json({ status: "ok", events });
}
