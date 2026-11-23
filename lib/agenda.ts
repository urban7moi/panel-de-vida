// Datos compartidos de la agenda: entrenos de la semana, tareas y utilidades de fechas.
import { PLAN_INFO, planForWeekday, type Settings } from "./settings";

export type Task = {
  id: string; // las que se repiten empiezan por "r:"
  title: string;
  time: string; // inicio "HH:MM" o "" (todo el día)
  end?: string; // fin "HH:MM"
  stars: number; // 1-5
  done: boolean;
  repeat?: string; // texto ("Cada día") si es una tarea que se repite
};

/** Tarea que se repite. */
export type Repeat = { kind: "daily" } | { kind: "weekdays" } | { kind: "weekly"; days: number[] } | { kind: "monthly"; day: number };
export type RecurringTask = { id: string; title: string; time: string; end?: string; stars: number; repeat: Repeat; from: string; skips: string[] };

const DAY_SHORT = ["D", "L", "M", "X", "J", "V", "S"];
export function repeatLabel(r: Repeat) {
  if (r.kind === "daily") return "Cada día";
  if (r.kind === "weekdays") return "De lunes a viernes";
  if (r.kind === "monthly") return `Cada mes, el día ${r.day}`;
  const order = [1, 2, 3, 4, 5, 6, 0];
  return `Cada ${order.filter((d) => r.days.includes(d)).map((d) => DAY_SHORT[d]).join(", ")}`;
}

/** ¿Toca esta tarea repetida ese día? */
export function occursOn(t: RecurringTask, key: string) {
  if (key < t.from || t.skips.includes(key)) return false;
  const d = dateFromKey(key);
  const wd = d.getDay();
  switch (t.repeat.kind) {
    case "daily":
      return true;
    case "weekdays":
      return wd >= 1 && wd <= 5;
    case "weekly":
      return t.repeat.days.includes(wd);
    case "monthly": {
      // Si el mes no tiene ese día (p. ej. 31), toca el último día del mes.
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(t.repeat.day, last);
    }
  }
}

/** Tareas de un día: las sueltas más las que se repiten (con su estado de hecha ese día). */
export function tasksOn(key: string, single: Record<string, Task[]>, recurring: RecurringTask[], doneRec: Record<string, string[]>): Task[] {
  const done = new Set(doneRec[key] ?? []);
  return [
    ...(single[key] ?? []),
    ...recurring
      .filter((r) => occursOn(r, key))
      .map((r) => ({ id: `r:${r.id}`, title: r.title, time: r.time, end: r.end, stars: r.stars, done: done.has(r.id), repeat: repeatLabel(r.repeat) })),
  ];
}

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

/** "HH:MM" sumando minutos (sin pasar de las 23:59). */
export function plusMinutes(hhmm: string, add: number) {
  const m = Math.min(23 * 60 + 59, toMinutes(hhmm) + add);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Fin de una tarea: el que tenga o, si no, 30 minutos después del inicio. */
export const endOf = (t: { time: string; end?: string }) => (t.end && t.end > t.time ? t.end : plusMinutes(t.time, 30));

/** "1 h 30 min" */
export function durationLabel(start: string, end: string) {
  const d = toMinutes(end) - toMinutes(start);
  if (d <= 0) return "";
  const h = Math.floor(d / 60);
  const m = d % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}
