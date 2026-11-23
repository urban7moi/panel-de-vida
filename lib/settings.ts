// Ajustes del usuario: objetivos y semana de entreno. Se usan en el móvil y en el servidor.

export type DayPlan = "push" | "pull" | "rehab" | "rest";

export type Settings = {
  weight: number; // kg
  proteinPerKg: number; // g por kg
  fatPerKg: number; // g por kg
  kcalTraining: number; // kcal en días de pesas
  kcalRest: number; // kcal en días sin pesas
  kcalAdjust: number; // ajuste por la tendencia del peso (se suma a los dos)
  schedule: Record<string, DayPlan>; // "0" domingo … "6" sábado
  workoutTime: string; // "12:00"
  waterGlasses: number; // vasos de 250 ml
  notify: { morning: boolean; evening: boolean };
};

export const DEFAULT_SETTINGS: Settings = {
  weight: 78,
  proteinPerKg: 2.2,
  fatPerKg: 0.95,
  kcalTraining: 2755,
  kcalRest: 2555,
  kcalAdjust: 0,
  schedule: { "0": "rest", "1": "push", "2": "pull", "3": "rehab", "4": "push", "5": "pull", "6": "rest" },
  workoutTime: "12:00",
  waterGlasses: 10,
  notify: { morning: true, evening: true },
};

/** Completa lo que falte (por si se guardaron ajustes de una versión anterior). */
export function withDefaults(s: Partial<Settings> | null | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...(s ?? {}),
    schedule: { ...DEFAULT_SETTINGS.schedule, ...(s?.schedule ?? {}) },
    notify: { ...DEFAULT_SETTINGS.notify, ...(s?.notify ?? {}) },
  };
}

export const PLAN_INFO: Record<DayPlan, { label: string; title: string; detail: string }> = {
  push: { label: "Push", title: "Entreno · Push", detail: "Pecho, hombro y tríceps" },
  pull: { label: "Pull", title: "Entreno · Pull", detail: "Espalda y bíceps" },
  rehab: { label: "Rodilla", title: "Rehabilitación de rodilla", detail: "Ejercicios del fisio" },
  rest: { label: "Descanso", title: "Descanso", detail: "" },
};

/** Plan de un día de la semana (0 = domingo). */
export const planForWeekday = (s: Settings, weekday: number): DayPlan => s.schedule[String(weekday)] ?? "rest";
export const isGymPlan = (p: DayPlan) => p === "push" || p === "pull";

const round5 = (n: number) => Math.round(n / 5) * 5;

/** Objetivos de macros para un día de pesas o de descanso. */
export function goalsFor(s: Settings, gymDay: boolean) {
  const p = round5(s.weight * s.proteinPerKg);
  const g = round5(s.weight * s.fatPerKg);
  const kcal = Math.max(1200, (gymDay ? s.kcalTraining : s.kcalRest) + s.kcalAdjust);
  const c = Math.max(0, Math.round((kcal - p * 4 - g * 9) / 4));
  return { kcal, p, c, g };
}
