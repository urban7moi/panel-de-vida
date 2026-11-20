import { cache } from "react";
import { getRecentWorkouts, getRoutines, hevyConfigured, HevyError, type HevyWorkout } from "./hevy";
import { buildTraining, type TrainingData } from "./training";
import { translateTraining } from "./exercise-names";

export type TrainingLoad =
  | { status: "ok"; data: TrainingData; workouts: HevyWorkout[] }
  | { status: "error"; error: string }
  | { status: "sin-configurar" };

/** Carga Hevy una sola vez por petición (lo comparten todas las secciones de la pantalla). */
export const loadTraining = cache(async (): Promise<TrainingLoad> => {
  if (!hevyConfigured()) return { status: "sin-configurar" };
  try {
    const [routines, workouts] = await Promise.all([getRoutines(), getRecentWorkouts(90)]);
    await translateTraining(routines, workouts);
    return { status: "ok", data: buildTraining(routines, workouts), workouts };
  } catch (err) {
    console.error("Hevy", err);
    const error =
      err instanceof HevyError && (err.status === 401 || err.status === 403)
        ? "Hevy no acepta la clave. Revisa HEVY_API_KEY en Vercel (y que tengas Hevy Pro)."
        : err instanceof HevyError && err.status === 429
          ? "Hevy ha limitado las peticiones. Prueba en unos minutos."
          : "No se pudo conectar con Hevy. Prueba en un rato.";
    return { status: "error", error };
  }
});
