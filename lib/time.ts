export const TZ = "Europe/Madrid";

/** "2026-11-12" de hoy en Madrid. */
export function todayMadrid(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

/** Hora local de Madrid ("2026-11-12T09:00:00") a ISO UTC. */
export function madridToISO(local: string) {
  const guess = new Date(local + "Z");
  const tzName = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")?.value;
  const offset = Number((tzName ?? "GMT+1").replace("GMT", "") || 0);
  return new Date(guess.getTime() - offset * 3600_000).toISOString();
}

/** Inicio y fin de un día de Madrid. */
export function dayBounds(date: string) {
  const start = new Date(madridToISO(`${date}T00:00:00`));
  const end = new Date(start.getTime() + 24 * 3600_000);
  return { start, end };
}

/** "09:30" en hora de Madrid. */
export function hhmm(iso: string) {
  return new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );
}
