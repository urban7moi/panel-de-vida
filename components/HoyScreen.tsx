"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, SunIcon } from "./icons";
import { useStored } from "@/lib/useStored";

type Task = {
  id: string;
  title: string;
  time: string; // "HH:MM" o ""
  stars: number; // 1-5
  done: boolean;
};

type Mail = { id: string; from: string; initials: string; subject: string; preview: string; time: string; important: boolean; unread: boolean };
type MailState = { status: "cargando" | "ok" | "error" | "sin-configurar"; mails: Mail[]; error?: string };

type AgendaItem =
  | { kind: "workout"; time: string; title: string; detail: string }
  | { kind: "task"; time: string; task: Task };

/** Entrenos de la semana, normalmente a las 12:00. */
const WORKOUT_TIME = "12:00";
const WORKOUTS: Record<number, { title: string; detail: string }> = {
  1: { title: "Entreno · Push", detail: "Pecho, hombro y tríceps" },
  2: { title: "Entreno · Pull", detail: "Espalda y bíceps" },
  3: { title: "Rehabilitación de rodilla", detail: "Ejercicios del fisio" },
  4: { title: "Entreno · Push", detail: "Pecho, hombro y tríceps" },
  5: { title: "Entreno · Pull", detail: "Espalda y bíceps" },
};

const DOW = ["L", "M", "X", "J", "V", "S", "D"];
const TZ = "Europe/Madrid";
const dateKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

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

  // --- Tareas: se guardan por día en este iPhone ---
  const [allTasks, setAllTasks] = useStored<Record<string, Task[]>>("tareas-v3", {});
  const dayTasks = (activeDay && allTasks[activeDay]) || [];
  const setDayTasks = (fn: (ts: Task[]) => Task[]) =>
    activeDay && setAllTasks((all) => ({ ...all, [activeDay]: fn(all[activeDay] ?? []) }));
  const sorted = sortTasks(dayTasks);
  const doneCount = dayTasks.filter((t) => t.done).length;
  const important = dayTasks.filter((t) => !t.done && t.stars >= 4).length;

  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState({ title: "", time: "", stars: 3 });

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return;
    setDayTasks((ts) => [...ts, { id: crypto.randomUUID(), title, time: form.time, stars: form.stars, done: false }]);
    setForm({ title: "", time: "", stars: 3 });
    setSheet(false);
  }
  const toggleTask = (id: string) => setDayTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  const removeTask = (id: string) => setDayTasks((ts) => ts.filter((x) => x.id !== id));

  // --- Agenda del día: entreno + tareas, por hora ---
  const activeDate = week.find((d) => d.key === activeDay)?.date ?? now;
  const workout = activeDate ? WORKOUTS[activeDate.getDay()] : undefined;
  const agenda: AgendaItem[] = [
    ...(workout ? [{ kind: "workout" as const, time: WORKOUT_TIME, ...workout }] : []),
    ...sorted.map((task) => ({ kind: "task" as const, time: task.time, task })),
  ].sort((a, b) => (a.time && b.time ? a.time.localeCompare(b.time) : a.time ? -1 : b.time ? 1 : 0));

  // --- Emails ---
  const [mail, setMail] = useState<MailState>({ status: "cargando", mails: [] });
  useEffect(() => {
    fetch("/api/mail")
      .then((r) => r.json())
      .then((j) => setMail({ status: j.status ?? "error", mails: j.mails ?? [], error: j.error }))
      .catch(() => setMail({ status: "error", mails: [], error: "No se pudo conectar con tu correo." }));
  }, []);
  const [mailTab, setMailTab] = useState<"imp" | "all">("imp");
  const importantMails = mail.mails.filter((m) => m.important);
  const visibleMails = mailTab === "imp" ? importantMails : mail.mails;

  // --- Resumen ---
  const isToday = activeDay === today;
  const nextTask = sorted.find((t) => !t.done && t.time);
  const greeting = !now ? "Hola" : now.getHours() < 13 ? "Buenos días" : now.getHours() < 21 ? "Buenas tardes" : "Buenas noches";
  const dateLabel = now ? now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) : "";
  const dayName = activeDate ? activeDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" }) : "";

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
          <h2 id="h-resumen" className="label-caps">{isToday ? "Resumen de hoy" : `Resumen del ${dayName}`}</h2>
        </div>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5 }}>
          {workout ? (
            <>{isToday ? "Hoy" : `El ${dayName}`} toca <strong>{workout.title.replace("Entreno · ", "")}</strong> a las {WORKOUT_TIME}. </>
          ) : (
            <>{isToday ? "Hoy" : `El ${dayName}`} es día de descanso. </>
          )}
          {dayTasks.length === 0 ? (
            <>No hay tareas apuntadas.</>
          ) : (
            <>
              Quedan <strong>{dayTasks.length - doneCount} {dayTasks.length - doneCount === 1 ? "tarea" : "tareas"}</strong>
              {important > 0 && <>, {important} muy {important === 1 ? "importante" : "importantes"}</>}.
              {nextTask && <> La próxima: {nextTask.title} a las {nextTask.time}.</>}
            </>
          )}
          {isToday && mail.status === "ok" && importantMails.length > 0 && (
            <> Tienes <strong>{importantMails.length} {importantMails.length === 1 ? "email importante" : "emails importantes"}</strong>.</>
          )}
        </p>
        <div className="tiles">
          <div className="tile">
            <span className="tile-value">{agenda.filter((i) => i.time).length}</span>
            <span className="tile-label">En la agenda</span>
          </div>
          <div className="tile">
            <span className="tile-value">{dayTasks.length - doneCount}</span>
            <span className="tile-label">Tareas pend.</span>
          </div>
          <div className="tile">
            <span className="tile-value">{important}</span>
            <span className="tile-label">Importantes</span>
          </div>
        </div>
      </section>

      {/* Calendario: agenda del día con el entreno y las tareas */}
      <section className="section" aria-labelledby="h-cal">
        <div className="section-head">
          <h2 id="h-cal" className="section-title">Calendario</h2>
          {!isToday && today && (
            <button type="button" className="link-btn" onClick={() => setSelectedDay(today)}>Volver a hoy</button>
          )}
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
              {d.key !== activeDay && (allTasks[d.key]?.length ?? 0) > 0 && <span className="day-dot" aria-hidden="true" />}
            </button>
          ))}
        </div>
        {agenda.length === 0 ? (
          <div className="card"><span className="small muted">Día libre: sin entreno ni tareas.</span></div>
        ) : (
          <div className="list">
            {agenda.map((item) =>
              item.kind === "workout" ? (
                <div className="row" key="workout">
                  <div className="time-col">
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{item.time}</span>
                  </div>
                  <div className="source-bar" style={{ background: "var(--google)" }} />
                  <div className="grow">
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{item.title}</span>
                    <span className="small muted">{item.detail}</span>
                  </div>
                </div>
              ) : (
                <div className="row" key={item.task.id}>
                  <div className="time-col">
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{item.time || "—"}</span>
                  </div>
                  <div className="source-bar" style={{ background: "var(--accent)", opacity: item.task.done ? 0.35 : 1 }} />
                  <div className="grow">
                    <span className={item.task.done ? "task-title done" : "task-title"} style={{ fontSize: 16 }}>{item.task.title}</span>
                    <Stars n={item.task.stars} size={12} />
                  </div>
                </div>
              ),
            )}
          </div>
        )}
        <div className="legend">
          <span><i className="dot" style={{ background: "var(--google)" }} />Entreno</span>
          <span><i className="dot" style={{ background: "var(--accent)" }} />Tareas</span>
        </div>
      </section>

      {/* Tareas */}
      <section className="section" aria-labelledby="h-tareas">
        <div className="section-head">
          <h2 id="h-tareas" className="section-title">{isToday ? "Tareas de hoy" : `Tareas del ${dayName}`}</h2>
          <span className="section-meta">{doneCount} de {dayTasks.length}</span>
        </div>

        {sorted.length > 0 && (
          <div className="list">
            {sorted.map((t) => (
              <div className={`task task-row imp-${t.stars}`} key={t.id}>
                <label className="task-check">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggleTask(t.id)}
                    aria-label={`Hecha: ${t.title}`}
                  />
                  <span className="check" aria-hidden="true">{t.done && <CheckIcon size={14} />}</span>
                </label>
                <span className="task-time">{t.time || "—"}</span>
                <span className="grow" style={{ gap: 4 }}>
                  <span className={t.done ? "task-title done" : "task-title"}>{t.title}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Stars n={t.stars} />
                  </span>
                </span>
                <button type="button" className="icon-btn" aria-label={`Borrar ${t.title}`} onClick={() => removeTask(t.id)}>×</button>
              </div>
            ))}
          </div>
        )}

        <button type="button" className="add-btn" onClick={() => setSheet(true)}>
          <span className="add-plus" aria-hidden="true">+</span>
          Añadir tarea
        </button>
      </section>

      {/* Emails */}
      <section className="section" aria-labelledby="h-mail">
        <div className="section-head">
          <h2 id="h-mail" className="section-title">Emails</h2>
          {mail.status === "ok" && <span className="small muted">Últimos 3 días</span>}
        </div>
        {mail.status === "sin-configurar" ? (
          <div className="card">
            <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Añade EMAIL_USER y EMAIL_APP_PASSWORD en Vercel y vuelve a desplegar para ver tu correo.
            </p>
          </div>
        ) : mail.status === "error" ? (
          <div className="card"><p className="error" role="alert" style={{ margin: 0 }}>{mail.error}</p></div>
        ) : mail.status === "cargando" ? (
          <div className="skeleton" style={{ height: 220 }} />
        ) : (
          <>
            <div className="segmented" role="tablist" aria-label="Filtrar emails">
              <button role="tab" aria-selected={mailTab === "imp"} onClick={() => setMailTab("imp")}>Importantes · {importantMails.length}</button>
              <button role="tab" aria-selected={mailTab === "all"} onClick={() => setMailTab("all")}>Todos · {mail.mails.length}</button>
            </div>
            {visibleMails.length === 0 ? (
              <div className="card"><span className="small muted">{mailTab === "imp" ? "Nada importante en los últimos 3 días." : "Bandeja vacía en los últimos 3 días."}</span></div>
            ) : (
              <div className="list">
                {visibleMails.map((m) => (
                  <div className="row mail" key={m.id}>
                    <span className="avatar" aria-hidden="true">{m.initials}</span>
                    <div className="grow" style={{ gap: 2 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                        <span className="ellipsis" style={{ fontSize: 15, fontWeight: m.unread ? 700 : 500 }}>
                          {m.unread && <i className="dot" style={{ background: "var(--accent)", marginRight: 6, verticalAlign: "middle" }} />}
                          {m.from}
                        </span>
                        <span className="tiny muted" style={{ flexShrink: 0 }}>{m.time}</span>
                      </div>
                      <span className="ellipsis" style={{ fontSize: 14, fontWeight: m.unread ? 600 : 500 }}>{m.subject}</span>
                      {m.preview && <span className="ellipsis small muted">{m.preview}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
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
