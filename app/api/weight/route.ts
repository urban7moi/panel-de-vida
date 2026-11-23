import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/api-auth";
import { getBodyWeights, hevyConfigured } from "@/lib/hevy";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  if (!hevyConfigured()) return NextResponse.json({ weights: [] });
  try {
    return NextResponse.json({ weights: await getBodyWeights() }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("Peso Hevy", err);
    return NextResponse.json({ weights: [] });
  }
}
