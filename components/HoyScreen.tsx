"use client";

import SettingsLink from "./SettingsLink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarIcon, CheckIcon, SunIcon } from "./icons";
import Stars from "./Stars";
import CalendarFull from "./CalendarFull";
import { useStored } from "@/lib/useStored";
import { addDays, agendaFor, dateFromKey, dateKey, DOW, repeatLabel, sortTasks, tasksOn, TZ, workoutFor, type RecurringTask, type Repeat, type Task } from "@/lib/agenda";
import { useSettings } from "@/lib/useSettings";


export default function HoyScreen() {
  const [settings] = useSettings();
  const WORKOUT_TIME = settings.workoutTime;
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
  const [recurring, setRecurring] = useStored<RecurringTask[]>("tareas-recurrentes", []);
  const [doneRec, setDoneRec] = useStored<Record<string, string[]>>("recurrentes-hechas", {});
  const getTasks = useCallback((key: string) => tasksOn(key, allTasks, recurring, doneRec), [allTasks, recurring, doneRec]);
  const dayTasks = activeDay ? getTasks(activeDay) : [];
  const setTasksOf = (day: string, fn: (ts: Task[]) => Task[]) =>
    setAllTasks((all) => ({ ...all, [day]: fn(all[day] ?? []) }));
  const setDayTasks = (fn: (ts: Task[]) => Task[]) => activeDay && setTasksOf(activeDay, fn);
  const sorted = sortTasks(dayTasks);
  const doneCount = dayTasks.filter((t) => t.done).length;
  const important = dayTasks.filter((t) => !t.done && t.stars >= 4).length;

  const [sheet, setSheet] = useState(false);
  type RepeatChoice = "none" | "daily" | "weekdays" | "weekly" | "monthly";
  const [form, setForm] = useState({ title: "", time: "", stars: 3, date: "", editId: "", repeat: "none" as RepeatChoice, days: [] as number[] });
  function openAdd(date: string, time = "") {
    setForm({ title: "", time, stars: 3, date, editId: "", repeat: "none", days: [dateFromKey(date).getDay()] });
    setSheet(true);
  }
  function openEdit(date: string, t: Task) {
    const rec = t.id.startsWith("r:") ? recurring.find((r) => r.id === t.id.slice(2)) : undefined;
    setForm({
      title: t.title,
      time: t.time,
      stars: t.stars,
      date,
      editId: t.id,
      repeat: rec ? rec.repeat.kind : "none",
      days: rec?.repeat.kind === "weekly" ? rec.repeat.days : [dateFromKey(date).getDay()],
    });
    setSheet(true);
  }
  const repeatOf = (f: typeof form): Repeat | null =>
    f.repeat === "none"
      ? null
      : f.repeat === "weekly"
        ? { kind: "weekly", days: f.days.length ? f.days : [dateFromKey(f.date).getDay()] }
        : f.repeat === "monthly"
          ? { kind: "monthly", day: dateFromKey(f.date).getDate() }
          : { kind: f.repeat };

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = form.title.trim();
    const day = form.date || activeDay;
    if (!title || !day) return;
    const repeat = repeatOf({ ...form, date: day });
    const editingRec = form.editId.startsWith("r:") ? form.editId.slice(2) : null;
    if (editingRec) {
      if (repeat) {
        setRecurring((rs) => rs.map((r) => (r.id === editingRec ? { ...r, title, time: form.time, stars: form.stars, repeat } : r)));
      } else {
        // Deja de repetirse: se queda como tarea suelta de ese día.
        setRecurring((rs) => rs.filter((r) => r.id !== editingRec));
        setTasksOf(day, (ts) => [...ts, { id: crypto.randomUUID(), title, time: form.time, stars: form.stars, done: false }]);
      }
    } else if (form.editId) {
      if (repeat) {
        setTasksOf(day, (ts) => ts.filter((t) => t.id !== form.editId));
        setRecurring((rs) => [...rs, { id: crypto.randomUUID(), title, time: form.time, stars: form.stars, repeat, from: day, skips: [] }]);
      } else {
        setTasksOf(day, (ts) => ts.map((t) => (t.id === form.editId ? { ...t, title, time: form.time, stars: form.stars } : t)));
      }
    } else if (repeat) {
      setRecurring((rs) => [...rs, { id: crypto.randomUUID(), title, time: form.time, stars: form.stars, repeat, from: day, skips: [] }]);
    } else {
      setTasksOf(day, (ts) => [...ts, { id: crypto.randomUUID(), title, time: form.time, stars: form.stars, done: false }]);
    }
    setSheet(false);
  }
  function deleteEditing(onlyThisDay = false) {
    const day = form.date || activeDay;
    if (!day || !form.editId) return;
    if (form.editId.startsWith("r:")) {
      const id = form.editId.slice(2);
      if (onlyThisDay) setRecurring((rs) => rs.map((r) => (r.id === id ? { ...r, skips: [...r.skips, day] } : r)));
      else setRecurring((rs) => rs.filter((r) => r.id !== id));
    } else {
      setTasksOf(day, (ts) => ts.filter((t) => t.id !== form.editId));
    }
    setSheet(false);
  }
  const toggleTask = (id: string) => {
    if (!activeDay) return;
    if (id.startsWith("r:")) {
      const rid = id.slice(2);
      setDoneRec((all) => {
        const cur = new Set(all[activeDay] ?? []);
        if (cur.has(rid)) cur.delete(rid);
        else cur.add(rid);
        return { ...all, [activeDay]: [...cur] };
      });
    } else {
      setDayTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
    }
  };
  const removeTask = (id: string) => {
    if (id.startsWith("r:") && activeDay) {
      // Quitar de la lista una tarea repetida = saltarla solo ese día.
      setRecurring((rs) => rs.map((r) => (r.id === id.slice(2) ? { ...r, skips: [...r.skips, activeDay] } : r)));
    } else {
      setDayTasks((ts) => ts.filter((x) => x.id !== id));
    }
  };

  // --- Lo que quedó pendiente ayer ---
  const yesterday = today ? addDays(today, -1) : null;
  const leftovers = yesterday ? (allTasks[yesterday] ?? []).filter((t) => !t.done) : [];
  function moveLeftoversToToday() {
    if (!today || !yesterday) return;
    setAllTasks((all) => ({
      ...all,
      [yesterday]: (all[yesterday] ?? []).filter((t) => t.done),
      [today]: [...(all[today] ?? []), ...leftovers.map((t) => ({ ...t, id: crypto.randomUUID() }))],
    }));
  }

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
  const workout = activeDay ? workoutFor(activeDay, settings) : undefined;
  const agenda = activeDay ? agendaFor(activeDay, dayTasks, workoutTime, settings) : [];

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
        <SettingsLink />
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
          ) : doneCount === dayTasks.length ? (
            <>Has terminado <strong>todas las tareas</strong>.</>
          ) : (
            <>
              Quedan <strong>{dayTasks.length - doneCount} {dayTasks.length - doneCount === 1 ? "tarea" : "tareas"}</strong>
              {important > 0 && <>, {important} muy {important === 1 ? "importante" : "importantes"}</>}.
              {nextTask && <> La próxima: {nextTask.title} a las {nextTask.time}.</>}
            </>
          )}
        </p>
        {dayTasks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span className="muted">Progreso del día</span>
              <span><strong>{doneCount}</strong> <span className="muted">de {dayTasks.length} hechas</span></span>
            </div>
            <div className="bar-track" role="img" aria-label={`${doneCount} de ${dayTasks.length} tareas hechas`}>
              <div className="bar-fill" style={{ width: `${Math.round((doneCount / dayTasks.length) * 100)}%`, transition: "width 0.3s ease" }} />
            </div>
          </div>
        )}
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

      {isToday && leftovers.length > 0 && (
        <section className="card leftovers" aria-label="Tareas pendientes de ayer">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              Te {leftovers.length === 1 ? "quedó 1 tarea" : `quedaron ${leftovers.length} tareas`} de ayer
            </span>
            <span className="small muted ellipsis">{leftovers.map((t) => t.title).join(" · ")}</span>
          </div>
          <button type="button" className="btn-primary" style={{ minHeight: 44, fontSize: 15 }} onClick={moveLeftoversToToday}>
            Pasar a hoy
          </button>
        </section>
      )}

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
              {d.key !== activeDay && getTasks(d.key).length > 0 && <span className="day-dot" aria-hidden="true" />}
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
                <button
                  type="button"
                  className="row row-btn"
                  key={item.task.id}
                  onClick={() => activeDay && openEdit(activeDay, item.task)}
                  aria-label={`Editar ${item.task.title}`}
                >
                  <div className="time-col">
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{item.time || "—"}</span>
                  </div>
                  <div className="source-bar" style={{ background: "var(--accent)", opacity: item.task.done ? 0.35 : 1 }} />
                  <div className="grow">
                    <span className={item.task.done ? "task-title done" : "task-title"} style={{ fontSize: 16 }}>{item.task.title}</span>
                    <Stars n={item.task.stars} size={12} />
                  </div>
                </button>
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
                <button type="button" className="grow task-edit" onClick={() => activeDay && openEdit(activeDay, t)} aria-label={`Editar ${t.title}`}>
                  <span className={t.done ? "task-title done" : "task-title"}>{t.title}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Stars n={t.stars} />
                    {t.repeat && <span className="repeat-tag">↻ {t.repeat}</span>}
                  </span>
                </button>
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
          getTasks={getTasks}
          settings={settings}
          workoutTimeFor={workoutTimeFor}
          onAdd={(date, time) => openAdd(date, time)}
          onEditWorkout={editWorkout}
        />
      )}

      {/* Hoja para cambiar la hora del entreno */}
      {timeSheet && workoutFor(timeSheet.date, settings) && (
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
              {workoutFor(timeSheet.date, settings)!.title} · {timeSheet.date === today ? "hoy" : dateFromKey(timeSheet.date).toLocaleDateString("es-ES", { weekday: "long", day: "numeric" })}
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
            <h2 id="h-nueva" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{form.editId ? "Editar tarea" : "Nueva tarea"}</h2>
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
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ marginBottom: 6 }}>Repetir</legend>
              <div className="chips" role="radiogroup" aria-label="Repetir">
                {([["none", "Nunca"], ["daily", "Cada día"], ["weekdays", "L a V"], ["weekly", "Días…"], ["monthly", "Cada mes"]] as const).map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={form.repeat === k} className="chip-btn plan-chip" onClick={() => setForm({ ...form, repeat: k })}>
                    {label}
                  </button>
                ))}
              </div>
              {form.repeat === "weekly" && (
                <div className="chips" style={{ marginTop: 8 }} aria-label="Días de la semana">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <button
                      key={d}
                      type="button"
                      role="checkbox"
                      aria-checked={form.days.includes(d)}
                      className="chip-btn plan-chip"
                      style={{ minWidth: 40 }}
                      onClick={() => setForm({ ...form, days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] })}
                    >
                      {["D", "L", "M", "X", "J", "V", "S"][d]}
                    </button>
                  ))}
                </div>
              )}
              {form.repeat !== "none" && form.date && (
                <span className="tiny muted" style={{ marginTop: 6, display: "block" }}>{repeatLabel(repeatOf(form)!)}</span>
              )}
            </fieldset>
            {form.editId.startsWith("r:") && (
              <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => deleteEditing(true)}>
                Quitar solo este día
              </button>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              {form.editId ? (
                <button type="button" className="btn-secondary danger" onClick={() => deleteEditing(false)}>
                  {form.editId.startsWith("r:") ? "Borrar serie" : "Borrar"}
                </button>
              ) : (
                <button type="button" className="btn-secondary" onClick={() => setSheet(false)}>Cancelar</button>
              )}
              <button type="submit" className="btn-primary" disabled={!form.title.trim()}>Guardar</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
