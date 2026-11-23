import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/api-auth";
import { cloudConfigured, getMany, isSyncKey, putStored } from "@/lib/store-server";

export const dynamic = "force-dynamic";

/** GET /api/store?keys=a,b → valores guardados en la nube con su fecha de cambio. */
export async function GET(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  if (!cloudConfigured()) return NextResponse.json({ configured: false, data: {} });
  const keys = (new URL(req.url).searchParams.get("keys") ?? "").split(",").filter(isSyncKey);
  try {
    return NextResponse.json({ configured: true, data: await getMany(keys) }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("Store GET", err);
    return NextResponse.json({ configured: true, error: "No se pudo leer de la nube." }, { status: 502 });
  }
}

/** PUT { key, v, t } → guarda si es más nuevo y devuelve lo que queda guardado. */
export async function PUT(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  if (!cloudConfigured()) return NextResponse.json({ configured: false });
  const body = (await req.json().catch(() => null)) as { key?: string; v?: unknown; t?: number } | null;
  if (!body || !body.key || !isSyncKey(body.key) || typeof body.t !== "number" || body.v === undefined) {
    return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
  }
  if (JSON.stringify(body.v).length > 900_000) {
    return NextResponse.json({ error: "Demasiados datos." }, { status: 413 });
  }
  try {
    const saved = await putStored(body.key, body.v, body.t);
    return NextResponse.json({ configured: true, saved });
  } catch (err) {
    console.error("Store PUT", err);
    return NextResponse.json({ error: "No se pudo guardar en la nube." }, { status: 502 });
  }
}
