"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarIcon, CheckIcon, SunIcon } from "./icons";
import Stars from "./Stars";
import CalendarFull from "./CalendarFull";
import { useStored } from "@/lib/useStored";
import { agendaFor, dateFromKey, dateKey, DOW, sortTasks, TZ, WORKOUT_TIME, workoutFor, type Task } from "@/lib/agenda";

type Mail = { id: string; from: string; initials: string; subject: string; preview: string; time: string; day: "hoy" | "ayer"; unread: boolean };
type MailState = { status: "cargando" | "ok" | "error" | "sin-configurar"; mails: Mail[]; unreadTotal?: number; error?: string };

export default function HoyScreen() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const today = now ? dateKey(now) : null;

  // Días del calendario: la semana pasada, esta y las 5 siguientes (se desliza en horizontal, semana a semana).
  const week = useMemo(() => {
    if (!now) return [];
    const monday = new Date(now);
    monday.setHours(12, 0, 0, 0);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7);
    return Array.from({ length: 7 * 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { dow: DOW[i % 7], date: d, key: dateKey(d), monday: i % 7 === 0 };
    });
  }, [now]);
  const stripRef = useRef<HTMLDivElement>(null);
  const scrollToDay = useCallback((key: string | null, smooth: boolean) => {
    const strip = stripRef.current;
    const el = key ? strip?.querySelector<HTMLElement>(`[data-key="${key}"]`) : null;
    if (!strip || !el) return;
    // Lleva a la vista la semana (empezando en lunes) que contiene ese día.
    const idx = Number(el.dataset.index);
    const mondayEl = strip.querySelector<HTMLElement>(`[data-index="${idx - (idx % 7)}"]`);
    strip.scrollTo({ left: (mondayEl ?? el).offsetLeft - strip.offsetLeft, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const activeDay = selectedDay ?? today;
  useEffect(() => {
    if (week.length) scrollToDay(today, false);
  }, [week, today, scrollToDay]);

  // --- Tareas: se guardan por día en este iPhone ---
  const [allTasks, setAllTasks] = useStored<Record<string, Task[]>>("tareas-v3", {});
  const dayTasks = (activeDay && allTasks[activeDay]) || [];
  const setTasksOf = (day: string, fn: (ts: Task[]) => Task[]) =>
    setAllTasks((all) => ({ ...all, [day]: fn(all[day] ?? []) }));
  const setDayTasks = (fn: (ts: Task[]) => Task[]) => activeDay && setTasksOf(activeDay, fn);
  const sorted = sortTasks(dayTasks);
  const doneCount = dayTasks.filter((t) => t.done).length;
  const important = dayTasks.filter((t) => !t.done && t.stars >= 4).length;

  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState({ title: "", time: "", stars: 3, date: "" });
  function openAdd(date: string, time = "") {
    setForm({ title: "", time, stars: 3, date });
    setSheet(true);
  }

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = form.title.trim();
    const day = form.date || activeDay;
    if (!title || !day) return;
    setTasksOf(day, (ts) => [...ts, { id: crypto.randomUUID(), title, time: form.time, stars: form.stars, done: false }]);
    setSheet(false);
  }
  const toggleTask = (id: string) => setDayTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  const removeTask = (id: string) => setDayTasks((ts) => ts.filter((x) => x.id !== id));

  // --- Hora del entreno: las 12:00 salvo que la cambies para un día concreto ---
  const [workoutTimes, setWorkoutTimes] = useStored<Record<string, string>>("entreno-horas", {});
  const workoutTimeFor = (key: string) => workoutTimes[key] || WORKOUT_TIME;
  const workoutTime = activeDay ? workoutTimeFor(activeDay) : WORKOUT_TIME;
  const [timeSheet, setTimeSheet] = useState<{ date: string; time: string } | null>(null);
  function saveWorkoutTime(time: string | null) {
    if (!timeSheet) return;
    const day = timeSheet.date;
    setWorkoutTimes((all) => {
      const next = { ...all };
      if (time && time !== WORKOUT_TIME) next[day] = time;
      else delete next[day];
      return next;
    });
    setTimeSheet(null);
  }
  const editWorkout = (date: string) => setTimeSheet({ date, time: workoutTimeFor(date) });

  // --- Calendario completo (estilo iPhone) ---
  const [fullCal, setFullCal] = useState(false);

  // --- Agenda del día: entreno + tareas, por hora ---
  const activeDate = activeDay ? dateFromKey(activeDay) : now;
  const workout = activeDay ? workoutFor(activeDay) : undefined;
  const agenda = activeDay ? agendaFor(activeDay, dayTasks, workoutTime) : [];

  // --- Emails ---
  const [mail, setMail] = useState<MailState>({ status: "cargando", mails: [] });
  useEffect(() => {
    // Enseña al momento los últimos emails guardados y los actualiza por detrás.
    let hadCache = false;
    try {
      const cached = localStorage.getItem("mail-cache-v2");
      if (cached) {
        setMail(JSON.parse(cached));
        hadCache = true;
      }
    } catch {
      /* sin caché */
    }
    fetch("/api/mail")
      .then((r) => r.json())
      .then((j) => {
        const next: MailState = { status: j.status ?? "error", mails: j.mails ?? [], unreadTotal: j.unreadTotal ?? 0, error: j.error };
        if (next.status === "error" && hadCache) return; // mejor lo último bueno que un error pasajero
        setMail(next);
        try {
          if (next.status === "ok") localStorage.setItem("mail-cache-v2", JSON.stringify(next));
        } catch {
          /* sin espacio */
        }
      })
      .catch(() => !hadCache && setMail({ status: "error", mails: [], error: "No se pudo conectar con tu correo." }));
  }, []);
  const unread = mail.unreadTotal ?? 0;

  // --- Resumen ---
  const isToday = activeDay === today;
  const nextTask = sorted.find((t) => !t.done && t.time);
  // Buenos días hasta las 12:59; buenas tardes desde las 13:00; buenas noches desde las 21:00 (hora de España).
  const hour = now ? Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(now)) % 24 : 0;
  const greeting = !now ? "Hola" : hour < 13 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";
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
            <>{isToday ? "Hoy" : `El ${dayName}`} toca <strong>{workout.title.replace("Entreno · ", "")}</strong> a las {workoutTime}. </>
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
          {isToday && mail.status === "ok" && unread > 0 && (
            <> Tienes <strong>{unread} {unread === 1 ? "email sin leer" : "emails sin leer"}</strong>.</>
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
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {!isToday && today && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setSelectedDay(today);
                scrollToDay(today, true);
              }}
            >
              Volver a hoy
            </button>
          )}
            <button type="button" className="open-cal" onClick={() => setFullCal(true)} aria-label="Abrir calendario completo">
              <CalendarIcon size={18} strokeWidth={2} />
              Abrir
            </button>
          </div>
        </div>
        <div className="week-scroll" ref={stripRef}>
          {week.map((d, i) => (
            <button
              key={d.key}
              data-key={d.key}
              data-index={i}
              data-today={d.key === today}
              className={d.monday ? "day snap" : "day"}
              aria-pressed={d.key === activeDay}
              aria-label={d.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" })}
              onClick={() => setSelectedDay(d.key)}
            >
              <span className="day-dow">{d.date.getDate() === 1 ? d.date.toLocaleDateString("es-ES", { month: "short" }).replace(".", "") : d.dow}</span>
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
                <button
                  type="button"
                  className="row row-btn"
                  key="workout"
                  onClick={() => activeDay && editWorkout(activeDay)}
                  aria-label={`${item.title} a las ${item.time}. Cambiar hora`}
                >
                  <div className="time-col">
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{item.time}</span>
                  </div>
                  <div className="source-bar" style={{ background: "var(--google)" }} />
                  <div className="grow">
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{item.title}</span>
                    <span className="small muted">{item.detail}</span>
                  </div>
                  <span className="tiny" style={{ color: "var(--google)", flexShrink: 0 }}>Cambiar hora</span>
                </button>
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

        <button type="button" className="add-btn" onClick={() => activeDay && openAdd(activeDay)}>
          <span className="add-plus" aria-hidden="true">+</span>
          Añadir tarea
        </button>
      </section>

      {/* Emails */}
      <section className="section" aria-labelledby="h-mail">
        <div className="section-head">
          <h2 id="h-mail" className="section-title">Emails · Principal</h2>
          {mail.status === "ok" && <span className="small muted">{unread > 0 ? `${unread} sin leer` : "Todo leído"}</span>}
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
          mail.mails.length === 0 ? (
            <div className="card"><span className="small muted">Ningún email en Principal ni hoy ni ayer.</span></div>
          ) : (
            (["hoy", "ayer"] as const).map((day) => {
              const list = mail.mails.filter((m) => m.day === day);
              if (list.length === 0) return null;
              return (
                <div key={day} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span className="label-caps" style={{ paddingLeft: 4 }}>{day === "hoy" ? "Hoy" : "Ayer"}</span>
                  <div className="list">
                    {list.map((m) => (
                      <div className="row mail" key={m.id}>
                        <span className="avatar" aria-hidden="true">{m.initials}</span>
                        <div className="grow" style={{ gap: 2 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                            <span className="ellipsis" style={{ fontSize: 15, fontWeight: m.unread ? 700 : 500 }}>{m.from}</span>
                            <span className="tiny muted" style={{ flexShrink: 0 }}>{m.time}</span>
                          </div>
                          <span className="ellipsis" style={{ fontSize: 14, fontWeight: m.unread ? 600 : 400 }}>{m.subject}</span>
                          {m.preview && <span className="ellipsis small muted">{m.preview}</span>}
                          {m.unread && <span className="chip" style={{ marginTop: 4 }}>No leído</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )
        )}
      </section>

      {/* Calendario completo */}
      {fullCal && today && activeDay && (
        <CalendarFull
          today={today}
          selected={activeDay}
          onSelect={(key) => {
            setSelectedDay(key);
            scrollToDay(key, false);
          }}
          onClose={() => setFullCal(false)}
          tasksByDay={allTasks}
          workoutTimeFor={workoutTimeFor}
          onAdd={(date, time) => openAdd(date, time)}
          onEditWorkout={editWorkout}
        />
      )}

      {/* Hoja para cambiar la hora del entreno */}
      {timeSheet && workoutFor(timeSheet.date) && (
        <div className="sheet-backdrop" onClick={() => setTimeSheet(null)}>
          <form
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              saveWorkoutTime(timeSheet.time);
            }}
            aria-labelledby="h-hora"
          >
            <div className="sheet-grip" aria-hidden="true" />
            <h2 id="h-hora" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Hora del entreno</h2>
            <span className="small muted">
              {workoutFor(timeSheet.date)!.title} · {timeSheet.date === today ? "hoy" : dateFromKey(timeSheet.date).toLocaleDateString("es-ES", { weekday: "long", day: "numeric" })}
            </span>
            <label className="field">Hora
              <input className="input" type="time" required value={timeSheet.time} onChange={(e) => setTimeSheet({ ...timeSheet, time: e.target.value })} />
            </label>
            {workoutTimeFor(timeSheet.date) !== WORKOUT_TIME && (
              <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => saveWorkoutTime(null)}>
                Volver a las {WORKOUT_TIME}
              </button>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn-secondary" onClick={() => setTimeSheet(null)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={!timeSheet.time}>Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* Hoja para añadir tarea */}
      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(false)}>
          <form className="sheet" onSubmit={addTask} onClick={(e) => e.stopPropagation()} aria-labelledby="h-nueva">
            <div className="sheet-grip" aria-hidden="true" />
            <h2 id="h-nueva" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Nueva tarea</h2>
            {form.date && (
              <span className="small muted" style={{ marginTop: -8 }}>
                {form.date === today ? "Hoy" : dateFromKey(form.date).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            )}
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
