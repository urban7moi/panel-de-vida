// Datos de ejemplo de la Fase 1. Se sustituirán por Google Calendar, iCloud, Gmail y Hevy.

export type Source = "google" | "apple" | "note";

export const events = [
  { start: "10:00", end: "11:00", title: "Reunión de equipo", meta: "Google Meet", source: "google" as Source },
  { start: "13:30", end: "14:30", title: "Comida con Laura", meta: "Centro", source: "apple" as Source },
  { start: "17:00", end: "17:30", title: "Llamar al gestor", meta: "Desde tu nota", source: "note" as Source },
  { start: "19:00", end: "20:15", title: "Entreno · Pierna", meta: "Rutina de Hevy", source: "apple" as Source },
];

export const tasks = [
  { id: "t1", title: "Revisar presupuesto de noviembre", time: "" },
  { id: "t2", title: "Llamar al gestor", time: "17:00" },
  { id: "t3", title: "Comprar proteína", time: "" },
  { id: "t4", title: "Enviar factura a cliente", time: "12:00" },
  { id: "t5", title: "Leer 20 páginas", time: "" },
];

export const mails = [
  { id: "m1", initials: "MR", from: "Marta Ruiz", time: "08:41", subject: "Propuesta revisada", preview: "Te paso la versión final para que la mires antes de…", important: true },
  { id: "m2", initials: "AM", from: "Amazon", time: "07:15", subject: "Tu pedido llega hoy", preview: "Tu paquete se entregará entre las 14:00 y las 18:00…", important: false },
  { id: "m3", initials: "AG", from: "Asesoría Gómez", time: "Ayer", subject: "Documentación IRPF", preview: "Necesitamos que nos envíes antes del viernes…", important: true },
  { id: "m4", initials: "HV", from: "Hevy", time: "Ayer", subject: "Nuevo récord personal", preview: "Has superado tu marca en press banca…", important: false },
];

export const workout = {
  name: "Pierna",
  time: "19:00",
  duration: "~ 70 min",
  exercises: [
    { name: "Sentadilla", last: "Última: 4 × 6 · 100 kg", target: "4 × 6 · 102,5 kg", note: "+2,5 kg" },
    { name: "Peso muerto rumano", last: "Última: 3 × 8 · 90 kg", target: "3 × 8 · 90 kg", note: "Mantén" },
    { name: "Prensa", last: "Última: 3 × 10 · 180 kg", target: "3 × 11 · 180 kg", note: "+1 rep" },
    { name: "Curl femoral", last: "Última: 3 × 12 · 45 kg", target: "3 × 12 · 47,5 kg", note: "+2,5 kg" },
  ],
};

/** Objetivo de recomposición para 78 kg. Día de entreno: más carbohidratos. */
export const macroGoals = {
  training: { p: 170, c: 320, g: 70 },
  rest: { p: 170, c: 270, g: 70 },
};

export const weeklyVolume = [38.2, 39.5, 37.8, 40.6, 41.9, 40.2, 42.8, 43.6]; // toneladas, 8 semanas
export const firstWeek = 39;

export const lifts = [
  { name: "Press banca", best: "Mejor: 85 kg × 5", e1rm: "1RM 96 kg", trend: "Sin cambios · 3 sem", up: false },
  { name: "Sentadilla", best: "Mejor: 100 kg × 6", e1rm: "1RM 117 kg", trend: "+4 kg este mes", up: true },
  { name: "Peso muerto", best: "Mejor: 130 kg × 4", e1rm: "1RM 144 kg", trend: "+6 kg este mes", up: true },
  { name: "Dominadas", best: "Mejor: +15 kg × 6", e1rm: "1RM +34 kg", trend: "+3 kg este mes", up: true },
];

export const coachTips = [
  { kind: "flat", title: "Press banca estancado", body: "Llevas 3 semanas en 85 kg × 5. Prueba 2 semanas de press inclinado con mancuernas a 4 × 8 y vuelve a probar la marca." },
  { kind: "balance", title: "Equilibra empuje y tirón", body: "Esta semana hiciste 16 series de pecho y 10 de espalda. Añade 4 series de remo para proteger los hombros." },
  { kind: "ok", title: "Recomposición en buen camino", body: "Pierdes 0,3 kg por semana y tu fuerza sube. Es el ritmo ideal: mantén las calorías como están." },
] as const;
