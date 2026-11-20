import { PushIcon, PullIcon, SparkIcon } from "../icons";
import type { CoachReport } from "@/lib/coach";

export default function Coach({ tips, lastDate }: { tips: CoachReport; lastDate: string | null }) {
  if (tips.push.length + tips.pull.length + tips.general.length === 0) return null;
  return (
        <section className="section" aria-labelledby="h-coach">
          <h2 id="h-coach" className="section-title">Tu entrenador</h2>
          {([
            ["push", "Push", tips.push, <PushIcon key="i" size={18} />, "var(--accent-text)"],
            ["pull", "Pull", tips.pull, <PullIcon key="i" size={18} />, "var(--google)"],
            ["general", "General", tips.general, <SparkIcon key="i" size={18} />, "var(--good)"],
          ] as const).map(([key, label, list, icon, color]) =>
            list.length === 0 ? null : (
              <div key={key} className="coach-group">
                <div className="coach-head" style={{ color }}>
                  <span className="tip-icon" style={{ color }}>{icon}</span>
                  <span className="label-caps" style={{ color }}>{label}</span>
                </div>
                {list.map((t) => (
                  <div className="tip" key={t.title} style={{ flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{t.title}</span>
                    <span className="tip-body">{t.body}</span>
                  </div>
                ))}
              </div>
            ),
          )}
          {lastDate && <span className="footnote">Análisis tras tu entreno del {lastDate}</span>}
        </section>
  );
}
