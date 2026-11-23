import { NextResponse } from "next/server";
import { cloudConfigured, getMany } from "@/lib/store-server";
import { sendToAll } from "@/lib/push";
import { dateFromKey, dateKey, sortTasks, tasksOn, workoutFor, type RecurringTask, type Task } from "@/lib/agenda";
import { goalsFor, isGymPlan, planForWeekday, withDefaults, type Settings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Avisos diarios (los lanza Vercel Cron, ver vercel.json):
 * - mañana: entreno del día, tareas y objetivo de proteína
 * - tarde: lo que te falta de proteína, calorías, agua y tareas
 */
export async function GET(req: Request) {
  // Solo Vercel Cron puede llamarlo: con CRON_SECRET (recomendado) o, si no existe, por su agente.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const agent = req.headers.get("user-agent") ?? "";
  if (secret ? auth !== `Bearer ${secret}` : !agent.startsWith("vercel-cron")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!cloudConfigured()) return NextResponse.json({ skipped: "sin nube" });

  const slot = new URL(req.url).searchParams.get("slot") === "evening" ? "evening" : "morning";
  const data = await getMany(["ajustes", "tareas-v3", "tareas-recurrentes", "recurrentes-hechas", "entreno-horas", "comidas-v2", "agua"]);
  const v = <T,>(k: string, d: T) => ((data[k]?.v as T | undefined) ?? d);
  const settings: Settings = withDefaults(v<Partial<Settings>>("ajustes", {}));
  if (!settings.notify[slot]) return NextResponse.json({ skipped: "desactivado" });

  const today = dateKey(new Date());
  const tasks: Task[] = tasksOn(today, v("tareas-v3", {}), v<RecurringTask[]>("tareas-recurrentes", []), v("recurrentes-hechas", {}));
  const pending = sortTasks(tasks.filter((t) => !t.done));
  const important = pending.filter((t) => t.stars >= 4).length;
  const plan = planForWeekday(settings, dateFromKey(today).getDay());
  const workout = workoutFor(today, settings);
  const workoutTime = v<Record<string, string>>("entreno-horas", {})[today] || settings.workoutTime;
  const goals = goalsFor(settings, isGymPlan(plan));

  let title: string;
  let body: string;
  if (slot === "morning") {
    title = "Buenos días";
    const parts = [
      workout ? `Hoy toca ${workout.label} a las ${workoutTime}` : "Hoy es día de descanso",
      pending.length ? `${pending.length} ${pending.length === 1 ? "tarea" : "tareas"}${important ? ` (${important} importante${important > 1 ? "s" : ""})` : ""}` : "sin tareas apuntadas",
      `objetivo: ${goals.p} g de proteína`,
    ];
    body = parts.join(" · ") + ".";
    const first = pending.find((t) => t.time);
    if (first) body += ` Primera: ${first.title} a las ${first.time}.`;
  } else {
    const meals = v<Record<string, { kcal: number; p: number }[]>>("comidas-v2", {})[today] ?? [];
    const p = meals.reduce((a, m) => a + m.p, 0);
    const kcal = meals.reduce((a, m) => a + m.kcal, 0);
    const glasses = v<Record<string, number>>("agua", {})[today] ?? 0;
    const faltan = Math.max(0, goals.p - p);
    title = faltan > 0 ? `Te faltan ${faltan} g de proteína` : "Proteína cumplida";
    const parts = [
      meals.length ? `Llevas ${kcal} de ${goals.kcal} kcal` : "No has apuntado comidas hoy",
      `agua ${glasses}/${settings.waterGlasses} vasos`,
      pending.length ? `${pending.length} ${pending.length === 1 ? "tarea pendiente" : "tareas pendientes"}` : "todas las tareas hechas",
    ];
    body = parts.join(" · ") + ".";
  }

  const sent = await sendToAll({ title, body, url: slot === "evening" ? "/comida" : "/" });
  return NextResponse.json({ slot, sent, title, body });
}
