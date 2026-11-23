// Datos compartidos de la agenda: entrenos de la semana, tareas y utilidades de fechas.
import { PLAN_INFO, planForWeekday, type Settings } from "./settings";

export type Task = {
  id: string;
  title: string;
  time: string; // "HH:MM" o ""
  stars: number; // 1-5
  done: boolean;
};

export type AgendaItem =
  | { kind: "workout"; time: string; title: string; detail: string }
  | { kind: "task"; time: string; task: Task };

export const DOW = ["L", "M", "X", "J", "V", "S", "D"];
export const TZ = "Europe/Madrid";

/** "2026-11-23" de una fecha, en hora de España. */
export const dateKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
/** Fecha (a mediodía, para evitar saltos de horario) a partir de "2026-11-23". */
export const dateFromKey = (key: string) => new Date(`${key}T12:00:00`);
/** Suma días a una clave de fecha. */
export function addDays(key: string, n: number) {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
/** Lunes de la semana de esa fecha. */
export const mondayOf = (key: string) => addDays(key, -((dateFromKey(key).getDay() + 6) % 7));

/** Entreno de ese día según tus ajustes (undefined si es día de descanso). */
export function workoutFor(key: string, settings: Settings) {
  const plan = planForWeekday(settings, dateFromKey(key).getDay());
  return plan === "rest" ? undefined : { plan, ...PLAN_INFO[plan] };
}

/** Por hora (las que no tienen hora, al final) y, a igual hora, las más importantes primero. */
export function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time);
    if (!!a.time !== !!b.time) return a.time ? -1 : 1;
    return b.stars - a.stars;
  });
}

/** Entreno y tareas de un día, ordenados por hora. */
export function agendaFor(key: string, tasks: Task[], workoutTime: string, settings: Settings): AgendaItem[] {
  const workout = workoutFor(key, settings);
  return [
    ...(workout ? [{ kind: "workout" as const, time: workoutTime, title: workout.title, detail: workout.detail }] : []),
    ...sortTasks(tasks).map((task) => ({ kind: "task" as const, time: task.time, task })),
  ].sort((a, b) => (a.time && b.time ? a.time.localeCompare(b.time) : a.time ? -1 : b.time ? 1 : 0));
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
