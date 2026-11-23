import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/api-auth";
import { getRecentWorkouts, hevyConfigured } from "@/lib/hevy";
import { workoutDays } from "@/lib/training";

export const dynamic = "force-dynamic";

/** Entrenos hechos por día (últimos 90 días) para marcarlos en la agenda. */
export async function GET() {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  if (!hevyConfigured()) return NextResponse.json({ status: "sin-configurar", days: [] });
  try {
    const workouts = await getRecentWorkouts(90);
    return NextResponse.json({ status: "ok", days: workoutDays(workouts) }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("Workouts", err);
    return NextResponse.json({ status: "error", days: [] });
  }
}
