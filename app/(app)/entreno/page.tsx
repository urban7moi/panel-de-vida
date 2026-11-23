import type { Metadata } from "next";
import { Suspense } from "react";
import SettingsLink from "@/components/SettingsLink";
import Progress from "@/components/entreno/Progress";
import TodayCard from "@/components/entreno/TodayCard";
import Coach from "@/components/entreno/Coach";
import { coachTips } from "@/lib/coach";
import { loadTraining } from "@/lib/load-training";

export const metadata: Metadata = { title: "Entreno · Panel de Vida" };

// La pantalla aparece al instante: cada sección se rellena en cuanto llegan sus datos.
export default function Page() {
  return (
    <main className="screen">
      <header className="header">
        <div className="header-titles">
          <span className="eyebrow">Recomposición · mantenimiento</span>
          <h1 className="title">Entreno</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Suspense fallback={<span className="sync"><i className="dot pulse" style={{ background: "var(--muted)" }} />Hevy</span>}>
            <HevyStatus />
          </Suspense>
          <SettingsLink />
        </div>
      </header>

      <Suspense fallback={<div className="skeleton" style={{ height: 330 }} />}>
        <TodaySection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton title="Progreso" height={420} />}>
        <ProgressSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton title="Tu entrenador" height={260} note="Preparando tu análisis…" />}>
        <CoachSection />
      </Suspense>
    </main>
  );
}

function SectionSkeleton({ title, height, note }: { title: string; height: number; note?: string }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">{title}</h2>
        {note && <span className="small muted">{note}</span>}
      </div>
      <div className="skeleton" style={{ height }} />
    </section>
  );
}

async function HevyStatus() {
  const t = await loadTraining();
  const ok = t.status === "ok";
  return (
    <span className="sync">
      <i className="dot" style={{ background: ok ? "var(--good)" : "var(--warn)" }} />
      {ok ? "Hevy · conectado" : t.status === "error" ? "Hevy · error" : "Hevy · sin conectar"}
    </span>
  );
}

async function TodaySection() {
  const t = await loadTraining();
  if (t.status === "sin-configurar")
    return (
      <section className="card">
        <h2 className="label-caps">Conecta Hevy</h2>
        <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Añade tu clave de la API de Hevy en Vercel (variable HEVY_API_KEY) y vuelve a desplegar para ver tus rutinas y tu progreso.
        </p>
      </section>
    );
  if (t.status === "error")
    return (
      <section className="card">
        <h2 className="label-caps">Hevy</h2>
        <p className="error" role="alert" style={{ margin: 0 }}>{t.error}</p>
      </section>
    );
  return <TodayCard session={t.data.session} />;
}

async function ProgressSection() {
  const t = await loadTraining();
  return t.status === "ok" ? <Progress data={t.data} /> : null;
}

async function CoachSection() {
  const t = await loadTraining();
  if (t.status !== "ok") return null;
  const tips = await coachTips(t.workouts, t.settings);
  return tips ? <Coach tips={tips} lastDate={t.data.lastWorkout?.date ?? null} /> : null;
}
