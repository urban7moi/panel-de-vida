import type { Metadata } from "next";
import EntrenoScreen from "@/components/EntrenoScreen";
import { getRecentWorkouts, getRoutines, hevyConfigured, HevyError } from "@/lib/hevy";
import { buildTraining, type TrainingData } from "@/lib/training";
import { coachTips, type CoachReport } from "@/lib/coach";
import { translateTraining } from "@/lib/exercise-names";

export const metadata: Metadata = { title: "Entreno · Panel de Vida" };

export default async function Page() {
  let data: TrainingData | null = null;
  let tips: CoachReport | null = null;
  let error: string | null = null;

  if (hevyConfigured()) {
    try {
      const [routines, workouts] = await Promise.all([getRoutines(), getRecentWorkouts(90)]);
      await translateTraining(routines, workouts);
      data = buildTraining(routines, workouts);
      tips = await coachTips(workouts);
    } catch (err) {
      console.error("Hevy", err);
      error =
        err instanceof HevyError && (err.status === 401 || err.status === 403)
          ? "Hevy no acepta la clave. Revisa HEVY_API_KEY en Vercel (y que tengas Hevy Pro)."
          : err instanceof HevyError && err.status === 429
            ? "Hevy ha limitado las peticiones. Prueba en unos minutos."
            : "No se pudo conectar con Hevy. Prueba en un rato.";
    }
  }

  return <EntrenoScreen data={data} tips={tips} hevy={hevyConfigured() ? (error ? "error" : "ok") : "sin-configurar"} error={error} />;
}
