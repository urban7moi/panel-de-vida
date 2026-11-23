// Tendencia del peso y propuesta de ajuste de calorías para recomposición en mantenimiento.
import { addDays, dateFromKey } from "./agenda";

export type WeightPoint = { date: string; kg: number };

/** Une los pesos de Hevy y los apuntados en la app (los de la app mandan si coinciden en día). */
export function mergeWeights(hevy: WeightPoint[], manual: Record<string, number>): WeightPoint[] {
  const map = new Map<string, number>();
  hevy.forEach((w) => map.set(w.date, w.kg));
  Object.entries(manual).forEach(([d, kg]) => map.set(d, kg));
  return [...map.entries()].map(([date, kg]) => ({ date, kg })).sort((a, b) => a.date.localeCompare(b.date));
}

const days = (a: string, b: string) => Math.round((dateFromKey(b).getTime() - dateFromKey(a).getTime()) / 864e5);

/** Pendiente en kg por semana (regresión lineal) de los últimos `window` días. */
export function weeklyTrend(points: WeightPoint[], today: string, window = 21) {
  const from = addDays(today, -window);
  const pts = points.filter((p) => p.date >= from);
  if (pts.length < 4 || days(pts[0].date, pts[pts.length - 1].date) < 10) return null;
  const xs = pts.map((p) => days(from, p.date));
  const ys = pts.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return den ? (num / den) * 7 : null;
}

/** Media de los últimos 7 días. */
export function weekAverage(points: WeightPoint[], today: string) {
  const pts = points.filter((p) => p.date > addDays(today, -7));
  return pts.length ? pts.reduce((a, p) => a + p.kg, 0) / pts.length : null;
}

/**
 * Objetivo: mantener o subir muy despacio (0 a +0,25 kg/semana).
 * Si bajas, se suben calorías; si subes rápido, se bajan un poco.
 */
export function calorieAdvice(trend: number | null, lastAdjust: string | undefined, today: string) {
  if (trend === null) return { kind: "pocos-datos" as const, delta: 0 };
  if (lastAdjust && days(lastAdjust, today) < 14) return { kind: "esperar" as const, delta: 0 };
  if (trend < -0.15) return { kind: "subir" as const, delta: trend < -0.4 ? 200 : 150 };
  if (trend > 0.35) return { kind: "bajar" as const, delta: -100 };
  return { kind: "bien" as const, delta: 0 };
}
