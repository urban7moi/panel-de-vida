// Rachas de constancia.
import { addDays, mondayOf } from "./agenda";

/**
 * Días seguidos cumpliendo algo. `status(day)` devuelve true (cumplido), false (fallado)
 * o null (no cuenta: p. ej. un día sin tareas). Hoy solo suma si ya está cumplido.
 */
export function dayStreak(today: string, status: (day: string) => boolean | null, maxDays = 365) {
  let n = 0;
  const t = status(today);
  if (t === true) n++;
  for (let i = 1; i <= maxDays; i++) {
    const s = status(addDays(today, -i));
    if (s === false) break;
    if (s === true) n++;
  }
  return n;
}

/**
 * Semanas seguidas sin saltarse ningún entreno programado.
 * La semana en curso no rompe la racha mientras no hayas fallado un día ya pasado,
 * y suma cuando la completas.
 */
export function weekStreak(today: string, isGymDay: (day: string) => boolean, trained: (day: string) => boolean, maxWeeks = 52) {
  const week = (monday: string) => Array.from({ length: 7 }, (_, d) => addDays(monday, d)).filter(isGymDay);
  let n = 0;
  const current = week(mondayOf(today));
  if (current.some((d) => d < today && !trained(d))) return 0;
  if (current.length && current.every(trained)) n++;
  let monday = addDays(mondayOf(today), -7);
  for (let w = 0; w < maxWeeks; w++, monday = addDays(monday, -7)) {
    const days = week(monday);
    if (!days.length) continue;
    if (!days.every(trained)) break;
    n++;
  }
  return n;
}
