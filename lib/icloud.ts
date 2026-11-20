// Calendario de Apple (iCloud) mediante CalDAV, con una contraseña de app.
import { createDAVClient, type DAVCalendar } from "tsdav";
import { madridToISO } from "./time";

export type CalEvent = {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  meta: string;
  source: "apple" | "panel";
  stars?: number;
};

export function icloudConfigured() {
  return !!(process.env.ICLOUD_USERNAME && process.env.ICLOUD_APP_PASSWORD);
}

async function client() {
  return createDAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: {
      username: process.env.ICLOUD_USERNAME!,
      password: process.env.ICLOUD_APP_PASSWORD!,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
}

function isEventCalendar(c: DAVCalendar) {
  const comps = c.components ?? [];
  return comps.length === 0 || comps.includes("VEVENT");
}

/** Calendario donde se crean las tareas: ICLOUD_CALENDAR por nombre, o el primero. */
async function targetCalendar(dav: Awaited<ReturnType<typeof client>>) {
  const cals = (await dav.fetchCalendars()).filter(isEventCalendar);
  const wanted = process.env.ICLOUD_CALENDAR?.toLowerCase();
  return (wanted && cals.find((c) => String(c.displayName ?? "").toLowerCase() === wanted)) || cals[0];
}

export async function icloudEvents(from: Date, to: Date): Promise<CalEvent[] | null> {
  if (!icloudConfigured()) return null;
  try {
    const dav = await client();
    const cals = (await dav.fetchCalendars()).filter(isEventCalendar);
    const all = await Promise.all(
      cals.map(async (cal) => {
        const objs = await dav.fetchCalendarObjects({
          calendar: cal,
          timeRange: { start: from.toISOString(), end: to.toISOString() },
          expand: true,
        });
        return objs.flatMap((o) => parseICS(String(o.data ?? ""), String(cal.displayName ?? "Apple")));
      }),
    );
    return all.flat();
  } catch (err) {
    console.error("iCloud", err);
    return null;
  }
}

/** Crea un evento de 30 minutos en iCloud para una tarea. Devuelve su uid. */
export async function icloudCreateEvent(title: string, date: string, time: string, stars: number, minutes = 30) {
  const dav = await client();
  const cal = await targetCalendar(dav);
  if (!cal) throw new Error("No hay calendarios en iCloud");
  const uid = `${crypto.randomUUID()}-panel-de-vida`;
  const [h, m] = time.split(":").map(Number);
  const startLocal = `${date.replace(/-/g, "")}T${pad(h)}${pad(m)}00`;
  const endMin = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  const endLocal = `${date.replace(/-/g, "")}T${pad(Math.floor(endMin / 60))}${pad(endMin % 60)}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Panel de Vida//ES",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/Madrid:${startLocal}`,
    `DTEND;TZID=Europe/Madrid:${endLocal}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:Tarea del Panel de Vida · Importancia ${stars}/5`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const res = await dav.createCalendarObject({ calendar: cal, filename: `${uid}.ics`, iCalString: ics });
  if (!res.ok) throw new Error(`iCloud ${res.status}`);
  return uid;
}

/** Borra el evento de una tarea creada desde el panel. */
export async function icloudDeleteEvent(uid: string) {
  if (!/^[a-z0-9-]+$/i.test(uid)) throw new Error("uid no válido");
  const dav = await client();
  const cal = await targetCalendar(dav);
  if (!cal) return;
  const url = new URL(`${uid}.ics`, cal.url.endsWith("/") ? cal.url : cal.url + "/").toString();
  const res = await dav.deleteCalendarObject({ calendarObject: { url, etag: "" } });
  if (!res.ok && res.status !== 404) throw new Error(`iCloud ${res.status}`);
}

const pad = (n: number) => String(n).padStart(2, "0");
const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

// --- Lectura mínima de iCalendar (suficiente para eventos simples y expandidos) ---

export function parseICS(ics: string, calName: string): CalEvent[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.split("BEGIN:VEVENT").slice(1);
  return blocks.map((b, i) => {
    const body = b.split("END:VEVENT")[0];
    const field = (name: string) => {
      const line = body.split(/\r?\n/).find((l) => l.startsWith(name + ":") || l.startsWith(name + ";"));
      if (!line) return { params: "", value: "" };
      const idx = line.indexOf(":");
      return { params: line.slice(name.length, idx), value: line.slice(idx + 1) };
    };
    const start = field("DTSTART");
    const end = field("DTEND");
    const summary = field("SUMMARY").value.replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/g, " ");
    const desc = field("DESCRIPTION").value;
    const location = field("LOCATION").value.replace(/\\,/g, ",");
    const allDay = start.params.includes("VALUE=DATE") && !start.value.includes("T");
    return {
      id: `a-${field("UID").value || i}-${start.value}`,
      title: summary || "(Sin título)",
      start: icsDate(start.value, start.params),
      end: icsDate(end.value || start.value, end.params || start.params),
      allDay,
      meta: location || calName,
      source: desc.includes("Panel de Vida") ? "panel" : "apple",
      stars: Number(desc.match(/Importancia (\d)\/5/)?.[1]) || undefined,
    } satisfies CalEvent;
  });
}

/** Convierte una fecha iCal a ISO. Las fechas sin "Z" se tratan como hora de Madrid. */
function icsDate(v: string, params: string) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h = "00", mi = "00", s = "00", z] = m;
  if (z) return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  if (params.includes("VALUE=DATE")) return `${y}-${mo}-${d}T00:00:00`;
  return madridToISO(`${y}-${mo}-${d}T${h}:${mi}:${s}`);
}

