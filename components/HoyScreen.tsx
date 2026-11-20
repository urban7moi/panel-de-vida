"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, SunIcon, CalendarIcon } from "./icons";
import { mails } from "@/lib/mock";
import { useStored } from "@/lib/useStored";

type CalEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  meta: string;
  source: "apple" | "panel";
  stars?: number;
};
type CalState = { status: "cargando" | "ok" | "error" | "sin-configurar"; events: CalEvent[] };

type Task = {
  id: string;
  title: string;
  time: string; // "HH:MM" o ""
  stars: number; // 1-5
  done: boolean;
  uid?: string; // evento en el Calendario de Apple
  cal?: "ok" | "error" | "guardando";
};

const DOW = ["L", "M", "X", "J", "V", "S", "D"];
const TZ = "Europe/Madrid";
const dateKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

/** Por hora (las que no tienen hora, al final) y, a igual hora, las más importantes primero. */
function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time);
    if (!!a.time !== !!b.time) return a.time ? -1 : 1;
    return b.stars - a.stars;
  });
}

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`Importancia ${n} de 5`} style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? "star on" : "star"}>★</span>
      ))}
    </span>
  );
}

export default function HoyScreen() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const today = now ? dateKey(now) : null;

  const week = useMemo(() => {
    if (!now) return [];
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return DOW.map((dow, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { dow, date: d, key: dateKey(d) };
    });
  }, [now]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const activeDay = selectedDay ?? today;

  // --- Calendario de Apple ---
  const [cal, setCal] = useState<CalState>({ status: "cargando", events: [] });
  const [calReload, setCalReload] = useState(0);
  useEffect(() => {
    if (!activeDay) return;
    let cancelled = false;
    setCal((c) => ({ status: "cargando", events: c.events }));
    fetch(`/api/calendar?date=${activeDay}`)
      .then((r) => r.json())
      .then((j: CalState) => !cancelled && setCal({ status: j.status ?? "error", events: j.events ?? [] }))
      .catch(() => !cancelled && setCal({ status: "error", events: [] }));
    return () => {
      cancelled = true;
    };
  }, [activeDay, calReload]);

  // --- Tareas (se guardan en este iPhone; las que tienen hora, también en tu calendario) ---
  const [tasks, setTasks] = useStored<Task[]>(`tareas-v2-${today ?? "hoy"}`, []);
  const sorted = sortTasks(tasks);
  const doneCount = tasks.filter((t) => t.done).length;
  const important = tasks.filter((t) => !t.done && t.stars >= 4).length;

  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState({ title: "", time: "", stars: 3, toCal: true });

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title || !today) return;
    const id = crypto.randomUUID();
    const sendToCal = !!form.time && form.toCal && cal.status !== "sin-configurar";
    const task: Task = { id, title, time: form.time, stars: form.stars, done: false, cal: sendToCal ? "guardando" : undefined };
    setTasks((ts) => [...ts, task]);
    setForm({ title: "", time: "", stars: 3, toCal: true });
    setSheet(false);
    if (!sendToCal) return;
    try {
      const res = await fetch("/api/tasks/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, date: today, time: task.time, stars: task.stars }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, uid: j.uid, cal: "ok" } : t)));
      if (activeDay === today) setCalReload((n) => n + 1);
    } catch {
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, cal: "error" } : t)));
    }
  }

  async function removeTask(t: Task) {
    setTasks((ts) => ts.filter((x) => x.id !== t.id));
    if (t.uid) {
      await fetch(`/api/tasks/event?uid=${encodeURIComponent(t.uid)}`, { method: "DELETE" }).catch(() => {});
      setCalReload((n) => n + 1);
    }
  }

  // --- Emails (aún de ejemplo) ---
  const [mailTab, setMailTab] = useState<"imp" | "all">("imp");
  const visibleMails = mailTab === "imp" ? mails.filter((m) => m.important) : mails;

  // --- Resumen ---
  const todayEvents = activeDay === today ? cal.events : [];
  const nextTask = sorted.find((t) => !t.done && t.time);
  const greeting = !now ? "Hola" : now.getHours() < 13 ? "Buenos días" : now.getHours() < 21 ? "Buenas tardes" : "Buenas noches";
  const dateLabel = now ? now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) : "";

  return (
    <main className="screen">
      <header className="header">
        <div className="header-titles">
          <span className="eyebrow">{dateLabel}&nbsp;</span>
          <h1 className="title">{greeting}</h1>
        </div>
      </header>

      {/* Resumen */}
      <section className="card" aria-labelledby="h-resumen">
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent)" }}>
          <SunIcon size={18} />
          <h2 id="h-resumen" className="label-caps">Resumen del día</h2>
        </div>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5 }}>
          {cal.status === "ok" && todayEvents.length > 0 ? (
            <>Tienes <strong>{todayEvents.length} {todayEvents.length === 1 ? "evento" : "eventos"}</strong>, el primero a las {todayEvents[0].allDay ? "todo el día" : hhmm(todayEvents[0].start)}. </>
          ) : cal.status === "ok" ? (
            <>No tienes eventos en el calendario. </>
          ) : null}
          {tasks.length === 0 ? (
            <>Aún no has añadido tareas para hoy.</>
          ) : (
            <>
              Te quedan <strong>{tasks.length - doneCount} {tasks.length - doneCount === 1 ? "tarea" : "tareas"}</strong>
              {important > 0 && <>, {important} muy {important === 1 ? "importante" : "importantes"}</>}.
              {nextTask && <> La próxima: {nextTask.title} a las {nextTask.time}.</>}
            </>
          )}
        </p>
        <div className="tiles">
          <div className="tile">
            <span className="tile-value">{cal.status === "ok" ? todayEvents.length : "–"}</span>
            <span className="tile-label">Eventos</span>
          </div>
          <div className="tile">
            <span className="tile-value">{tasks.length - doneCount}</span>
            <span className="tile-label">Tareas pend.</span>
          </div>
          <div className="tile">
            <span className="tile-value">{important}</span>
            <span className="tile-label">Importantes</span>
          </div>
        </div>
      </section>

      {/* Tareas */}
      <section className="section" aria-labelledby="h-tareas">
        <div className="section-head">
          <h2 id="h-tareas" className="section-title">Tareas de hoy</h2>
          <span className="section-meta">{doneCount} de {tasks.length}</span>
        </div>

        {sorted.length > 0 && (
          <div className="list">
            {sorted.map((t) => (
              <div className={`task task-row imp-${t.stars}`} key={t.id}>
                <label className="task-check">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
                    aria-label={`Hecha: ${t.title}`}
                  />
                  <span className="check" aria-hidden="true">{t.done && <CheckIcon size={14} />}</span>
                </label>
                <span className="task-time">{t.time || "—"}</span>
                <span className="grow" style={{ gap: 4 }}>
                  <span className={t.done ? "task-title done" : "task-title"}>{t.title}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Stars n={t.stars} />
                    {t.cal === "ok" && (
                      <span className="tiny muted" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <CalendarIcon size={12} strokeWidth={2} />En tu calendario
                      </span>
                    )}
                    {t.cal === "guardando" && <span className="tiny muted">Añadiendo al calendario…</span>}
                    {t.cal === "error" && <span className="tiny" style={{ color: "var(--accent-text)" }}>No se pudo añadir al calendario</span>}
                  </span>
                </span>
                <button type="button" className="icon-btn" aria-label={`Borrar ${t.title}`} onClick={() => removeTask(t)}>×</button>
              </div>
            ))}
          </div>
        )}

        <button type="button" className="add-btn" onClick={() => setSheet(true)}>
          <span className="add-plus" aria-hidden="true">+</span>
          Añadir tarea
        </button>
      </section>

      {/* Calendario */}
      <section className="section" aria-labelledby="h-cal">
        <div className="section-head">
          <h2 id="h-cal" className="section-title">Calendario</h2>
          {cal.status === "cargando" && <span className="small muted">Cargando…</span>}
        </div>
        <div className="week">
          {week.map((d) => (
            <button
              key={d.key}
              className="day"
              aria-pressed={d.key === activeDay}
              aria-label={d.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" })}
              onClick={() => setSelectedDay(d.key)}
            >
              <span className="day-dow">{d.dow}</span>
              <span className="day-num">{d.date.getDate()}</span>
            </button>
          ))}
        </div>

        {cal.status === "sin-configurar" ? (
          <div className="card">
            <h3 className="label-caps" style={{ margin: 0 }}>Conecta tu Calendario de Apple</h3>
            <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Añade en Vercel ICLOUD_USERNAME (tu Apple ID) e ICLOUD_APP_PASSWORD (una contraseña de app) y vuelve a desplegar.
            </p>
          </div>
        ) : cal.status === "error" ? (
          <div className="card">
            <p className="error" role="alert" style={{ margin: 0 }}>No se pudo leer tu Calendario de Apple. Revisa la contraseña de app.</p>
          </div>
        ) : cal.events.length === 0 && cal.status === "ok" ? (
          <div className="card"><span className="small muted">Nada en el calendario este día.</span></div>
        ) : (
          <div className="list" style={{ opacity: cal.status === "cargando" ? 0.6 : 1 }}>
            {cal.events.map((e) => (
              <div className="row" key={e.id}>
                <div className="time-col">
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{e.allDay ? "Todo" : hhmm(e.start)}</span>
                  <span className="tiny muted">{e.allDay ? "el día" : hhmm(e.end)}</span>
                </div>
                <div className="source-bar" style={{ background: e.source === "panel" ? "var(--accent)" : "var(--apple)" }} />
                <div className="grow">
                  <span style={{ fontSize: 16, fontWeight: 500 }}>{e.title}</span>
                  {e.source === "panel" && e.stars ? <Stars n={e.stars} size={12} /> : <span className="small muted">{e.meta}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="legend">
          <span><i className="dot" style={{ background: "var(--apple)" }} />Calendario de Apple</span>
          <span><i className="dot" style={{ background: "var(--accent)" }} />Tareas del panel</span>
        </div>
      </section>

      {/* Emails */}
      <section className="section" aria-labelledby="h-mail">
        <div className="section-head">
          <h2 id="h-mail" className="section-title">Emails</h2>
          <span className="small muted">Ejemplo</span>
        </div>
        <div className="segmented" role="tablist" aria-label="Filtrar emails">
          <button role="tab" aria-selected={mailTab === "imp"} onClick={() => setMailTab("imp")}>Importantes</button>
          <button role="tab" aria-selected={mailTab === "all"} onClick={() => setMailTab("all")}>Todos</button>
        </div>
        <div className="list">
          {visibleMails.map((m) => (
            <div className="row mail" key={m.id}>
              <span className="avatar" aria-hidden="true">{m.initials}</span>
              <div className="grow" style={{ gap: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span className="ellipsis" style={{ fontSize: 15, fontWeight: 600 }}>{m.from}</span>
                  <span className="tiny muted" style={{ flexShrink: 0 }}>{m.time}</span>
                </div>
                <span className="ellipsis" style={{ fontSize: 14, fontWeight: 500 }}>{m.subject}</span>
                <span className="ellipsis small muted">{m.preview}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Hoja para añadir tarea */}
      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(false)}>
          <form className="sheet" onSubmit={addTask} onClick={(e) => e.stopPropagation()} aria-labelledby="h-nueva">
            <div className="sheet-grip" aria-hidden="true" />
            <h2 id="h-nueva" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Nueva tarea</h2>
            <label className="field">Nombre
              <input
                className="input"
                autoFocus
                placeholder="Ej. Llamar al fisio"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label className="field">Hora (opcional)
              <input className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </label>
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ marginBottom: 6 }}>Importancia</legend>
              <div className="star-picker">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`${i} ${i === 1 ? "estrella" : "estrellas"}`}
                    aria-pressed={form.stars === i}
                    className={i <= form.stars ? "star-btn on" : "star-btn"}
                    onClick={() => setForm({ ...form, stars: i })}
                  >
                    ★
                  </button>
                ))}
              </div>
            </fieldset>
            {form.time && cal.status !== "sin-configurar" && (
              <label className="toggle-row">
                <input type="checkbox" checked={form.toCal} onChange={(e) => setForm({ ...form, toCal: e.target.checked })} />
                Añadir también a mi Calendario de Apple
              </label>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn-secondary" onClick={() => setSheet(false)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={!form.title.trim()}>Guardar</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
