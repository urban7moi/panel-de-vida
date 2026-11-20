import { NextResponse } from "next/server";
import { z } from "zod";
import { isLoggedIn } from "@/lib/api-auth";
import { icloudConfigured, icloudCreateEvent, icloudDeleteEvent } from "@/lib/icloud";

const Body = z.object({
  title: z.string().trim().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  stars: z.number().int().min(1).max(5),
});

/** Crea en el Calendario de Apple el evento de una tarea con hora. */
export async function POST(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  if (!icloudConfigured()) return NextResponse.json({ error: "Calendario de Apple sin configurar." }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos de la tarea no válidos." }, { status: 400 });
  const { title, date, time, stars } = parsed.data;
  try {
    const uid = await icloudCreateEvent(title, date, time, stars);
    return NextResponse.json({ uid });
  } catch (err) {
    console.error("iCloud crear", err);
    return NextResponse.json({ error: "No se pudo añadir al Calendario de Apple." }, { status: 502 });
  }
}

/** Borra el evento de una tarea (?uid=...). */
export async function DELETE(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  const uid = new URL(req.url).searchParams.get("uid") ?? "";
  if (!icloudConfigured() || !uid) return NextResponse.json({ ok: true });
  try {
    await icloudDeleteEvent(uid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("iCloud borrar", err);
    return NextResponse.json({ error: "No se pudo borrar del Calendario de Apple." }, { status: 502 });
  }
}
