"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Stars from "./Stars";
import {
  addDays,
  agendaFor,
  dateFromKey,
  dateKey,
  DOW,
  mondayOf,
  toMinutes,
  TZ,
  workoutFor,
  type Task,
} from "@/lib/agenda";
import type { Settings } from "@/lib/settings";

type Props = {
  today: string;
  selected: string;
  onSelect: (key: string) => void;
  onClose: () => void;
  tasksByDay: Record<string, Task[]>;
  settings: Settings;
  workoutTimeFor: (key: string) => string;
  onAdd: (date: string, time: string) => void;
  onEditWorkout: (date: string) => void;
};

const HOUR_PX = 52;
const FIRST_HOUR = 6;
const LAST_HOUR = 24;

/** Calendario a pantalla completa, al estilo del iPhone: vista Mes y vista Semana. */
export default function CalendarFull({ today, selected, onSelect, onClose, tasksByDay, settings, workoutTimeFor, onAdd, onEditWorkout }: Props) {
  const [view, setView] = useState<"mes" | "semana">("mes");
  const [month, setMonth] = useState(() => selected.slice(0, 7)); // "2026-11"
  const [weekStart, setWeekStart] = useState(() => mondayOf(selected));

  // Bloquea el scroll de la página de debajo mientras está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function select(key: string) {
    onSelect(key);
    setMonth(key.slice(0, 7));
    setWeekStart(mondayOf(key));
  }

  // --- Mes ---
  const monthDays = useMemo(() => {
    const first = `${month}-01`;
    const start = mondayOf(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);
  const monthDate = dateFromKey(`${month}-01`);
  const monthLabel = cap(monthDate.toLocaleDateString("es-ES", { month: "long" }));
  const yearLabel = String(monthDate.getFullYear());
  function shiftMonth(n: number) {
    const d = dateFromKey(`${month}-01`);
    d.setMonth(d.getMonth() + n);
    setMonth(dateKey(d).slice(0, 7));
  }

  // --- Semana ---
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekLabel = (() => {
    const a = dateFromKey(weekDays[0]);
    const b = dateFromKey(weekDays[6]);
    const sameMonth = a.getMonth() === b.getMonth();
    return `${a.getDate()}${sameMonth ? "" : " " + a.toLocaleDateString("es-ES", { month: "short" }).replace(".", "")} – ${b.getDate()} ${b
      .toLocaleDateString("es-ES", { month: "short" })
      .replace(".", "")}`;
  })();

  const gridRef = useRef<HTMLDivElement>(null);
  const [nowMin, setNowMin] = useState(() => minutesNow());
  useEffect(() => {
    const t = setInterval(() => setNowMin(minutesNow()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (view !== "semana" || !gridRef.current) return;
    // Empieza mostrando una hora antes de ahora (o las 8:00).
    const target = weekDays.includes(today) ? Math.max(nowMin / 60 - 1, FIRST_HOUR) : 8;
    gridRef.current.scrollTop = (target - FIRST_HOUR) * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, weekStart]);

  const selectedDate = dateFromKey(selected);
  const selectedLabel = cap(selectedDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }));
  const agenda = agendaFor(selected, tasksByDay[selected] ?? [], workoutTimeFor(selected), settings);

  return (
    <div className="fullcal" role="dialog" aria-modal="true" aria-labelledby="h-fullcal">
      <div className="fullcal-top">
        <div className="fullcal-head">
          <h2 id="h-fullcal" className="fullcal-title">
            {view === "mes" ? monthLabel : weekLabel}
            {view === "mes" && <span className="fullcal-year">{yearLabel}</span>}
          </h2>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button type="button" className="round-btn accent" aria-label="Añadir tarea" onClick={() => onAdd(selected, "")}>+</button>
            <button type="button" className="fullcal-done" onClick={onClose}>Hecho</button>
          </div>
        </div>
        <div className="fullcal-tools">
          <div className="segmented" role="tablist" aria-label="Vista del calendario" style={{ flex: 1 }}>
            <button role="tab" aria-selected={view === "mes"} onClick={() => setView("mes")}>Mes</button>
            <button role="tab" aria-selected={view === "semana"} onClick={() => setView("semana")}>Semana</button>
          </div>
          {selected !== today && (
            <button type="button" className="link-btn" onClick={() => select(today)}>Hoy</button>
          )}
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button type="button" className="round-btn" aria-label={view === "mes" ? "Mes anterior" : "Semana anterior"} onClick={() => (view === "mes" ? shiftMonth(-1) : setWeekStart(addDays(weekStart, -7)))}>‹</button>
            <button type="button" className="round-btn" aria-label={view === "mes" ? "Mes siguiente" : "Semana siguiente"} onClick={() => (view === "mes" ? shiftMonth(1) : setWeekStart(addDays(weekStart, 7)))}>›</button>
          </div>
        </div>
      </div>

      {view === "mes" ? (
        <div className="fullcal-body">
          <div className="month-grid" role="grid" aria-label={`${monthLabel} ${yearLabel}`}>
            {DOW.map((d) => (
              <span key={d} className="month-dow">{d}</span>
            ))}
            {monthDays.map((key) => {
              const d = dateFromKey(key);
              const out = key.slice(0, 7) !== month;
              const hasTasks = (tasksByDay[key]?.length ?? 0) > 0;
              return (
                <button
                  key={key}
                  type="button"
                  className={`month-cell${out ? " out" : ""}${key === today ? " today" : ""}`}
                  aria-pressed={key === selected}
                  aria-label={d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                  onClick={() => select(key)}
                >
                  <span className="month-num">{d.getDate()}</span>
                  <span className="month-dots" aria-hidden="true">
                    {workoutFor(key, settings) && <i style={{ background: "var(--google)" }} />}
                    {hasTasks && <i style={{ background: "var(--accent)" }} />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="fullcal-day">
            <h3 className="fullcal-daytitle">{selectedLabel}</h3>
            {agenda.length === 0 ? (
              <div className="card"><span className="small muted">Día libre: sin entreno ni tareas.</span></div>
            ) : (
              <div className="list">
                {agenda.map((item) =>
                  item.kind === "workout" ? (
                    <button type="button" className="row row-btn" key="workout" onClick={() => onEditWorkout(selected)}>
                      <div className="time-col"><span style={{ fontSize: 15, fontWeight: 600 }}>{item.time}</span></div>
                      <div className="source-bar" style={{ background: "var(--google)" }} />
                      <div className="grow">
                        <span style={{ fontSize: 16, fontWeight: 600 }}>{item.title}</span>
                        <span className="small muted">{item.detail}</span>
                      </div>
                      <span className="tiny" style={{ color: "var(--google)", flexShrink: 0 }}>Cambiar hora</span>
                    </button>
                  ) : (
                    <div className="row" key={item.task.id}>
                      <div className="time-col"><span style={{ fontSize: 15, fontWeight: 600 }}>{item.time || "—"}</span></div>
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
            <button type="button" className="add-btn" onClick={() => onAdd(selected, "")}>
              <span className="add-plus" aria-hidden="true">+</span>
              Añadir tarea a este día
            </button>
          </div>
        </div>
      ) : (
        <div className="fullcal-week">
          <div className="wk-head">
            <span className="wk-gutter" />
            {weekDays.map((key, i) => {
              const d = dateFromKey(key);
              const untimed = (tasksByDay[key] ?? []).filter((t) => !t.time).length;
              return (
                <button
                  key={key}
                  type="button"
                  className={`wk-day${key === today ? " today" : ""}`}
                  aria-pressed={key === selected}
                  onClick={() => select(key)}
                  aria-label={d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" })}
                >
                  <span className="wk-dow">{DOW[i]}</span>
                  <span className="wk-num">{d.getDate()}</span>
                  {untimed > 0 && <span className="wk-untimed">{untimed} sin hora</span>}
                </button>
              );
            })}
          </div>
          <div className="wk-grid" ref={gridRef}>
            <div className="wk-inner" style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX }}>
              <div className="wk-hours" aria-hidden="true">
                {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => (
                  <span key={i} style={{ top: i * HOUR_PX }}>{String(FIRST_HOUR + i).padStart(2, "0")}:00</span>
                ))}
              </div>
              {weekDays.map((key) => (
                <DayColumn
                  key={key}
                  dayKey={key}
                  isToday={key === today}
                  nowMin={nowMin}
                  tasks={tasksByDay[key] ?? []}
                  workoutTime={workoutTimeFor(key)}
                  settings={settings}
                  onEmpty={(time) => {
                    select(key);
                    onAdd(key, time);
                  }}
                  onWorkout={() => {
                    select(key);
                    onEditWorkout(key);
                  }}
                  onTask={() => {
                    select(key);
                    setView("mes");
                  }}
                />
              ))}
            </div>
          </div>
          <p className="tiny muted" style={{ margin: "8px 16px 0", textAlign: "center" }}>Toca un hueco para añadir una tarea a esa hora</p>
        </div>
      )}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Nombre corto del entreno para los bloques de la vista semana. */
const shortWorkout = (title: string) => title.replace("Entreno · ", "").replace("Rehabilitación de rodilla", "Rodilla");

function minutesNow() {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date())
    .split(":")
    .map(Number);
  return (h % 24) * 60 + m;
}

type Block = { id: string; start: number; end: number; title: string; kind: "workout" | "task"; done?: boolean; col: number; cols: number };

/** Coloca los bloques en columnas cuando se solapan (como en el calendario del iPhone). */
function layout(blocks: Omit<Block, "col" | "cols">[]): Block[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Block[] = [];
  let cluster: Block[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((b) => b.col + 1));
    cluster.forEach((b) => (b.cols = cols));
    out.push(...cluster);
    cluster = [];
  };
  for (const b of sorted) {
    if (b.start >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.end > b.start).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ ...b, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, b.end);
  }
  if (cluster.length) flush();
  return out;
}

function DayColumn({
  dayKey,
  isToday,
  nowMin,
  tasks,
  workoutTime,
  settings,
  onEmpty,
  onWorkout,
  onTask,
}: {
  dayKey: string;
  isToday: boolean;
  nowMin: number;
  tasks: Task[];
  workoutTime: string;
  settings: Settings;
  onEmpty: (time: string) => void;
  onWorkout: () => void;
  onTask: () => void;
}) {
  const workout = workoutFor(dayKey, settings);
  const blocks = layout([
    ...(workout ? [{ id: "w", start: toMinutes(workoutTime), end: toMinutes(workoutTime) + 60, title: shortWorkout(workout.title), kind: "workout" as const }] : []),
    ...tasks
      .filter((t) => t.time)
      .map((t) => ({ id: t.id, start: toMinutes(t.time), end: toMinutes(t.time) + 45, title: t.title, kind: "task" as const, done: t.done })),
  ]);
  const top = (min: number) => ((min - FIRST_HOUR * 60) / 60) * HOUR_PX;

  return (
    <div
      className={`wk-col${isToday ? " today" : ""}`}
      onClick={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const hour = Math.min(LAST_HOUR - 1, Math.max(FIRST_HOUR, Math.floor((e.clientY - rect.top) / HOUR_PX) + FIRST_HOUR));
        onEmpty(`${String(hour).padStart(2, "0")}:00`);
      }}
    >
      {blocks.map((b) => (
        <button
          key={b.id}
          type="button"
          className={`wk-block ${b.kind}${b.done ? " done" : ""}`}
          style={{
            top: Math.max(0, top(b.start)),
            height: Math.max(22, ((b.end - b.start) / 60) * HOUR_PX - 2),
            left: `${(b.col / b.cols) * 100}%`,
            width: `calc(${100 / b.cols}% - 2px)`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (b.kind === "workout") onWorkout();
            else onTask();
          }}
          aria-label={`${b.title} a las ${String(Math.floor(b.start / 60)).padStart(2, "0")}:${String(b.start % 60).padStart(2, "0")}`}
        >
          {b.title}
        </button>
      ))}
      {isToday && nowMin >= FIRST_HOUR * 60 && <span className="wk-now" style={{ top: top(nowMin) }} aria-hidden="true" />}
    </div>
  );
}
