import { PushIcon, PullIcon, SparkIcon } from "../icons";
import type { CoachReport } from "@/lib/coach";

const GROUPS = [
  { key: "push", label: "Push", Icon: PushIcon, color: "var(--accent-text)" },
  { key: "pull", label: "Pull", Icon: PullIcon, color: "var(--google)" },
  { key: "general", label: "General", Icon: SparkIcon, color: "var(--good)" },
] as const;

export default function Coach({ tips, lastDate }: { tips: CoachReport; lastDate: string | null }) {
  const items = GROUPS.map((g) => ({ ...g, tip: tips[g.key] })).filter((g) => g.tip);
  if (items.length === 0) return null;
  return (
    <section className="section" aria-labelledby="h-coach">
      <h2 id="h-coach" className="section-title">Tu entrenador</h2>
      {items.map(({ key, label, Icon, color, tip }) => (
        <article className="coach-card" key={key}>
          <div className="coach-head">
            <span className="tip-icon" style={{ color }}><Icon size={18} /></span>
            <span className="label-caps" style={{ color }}>{label}</span>
          </div>
          <span style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{tip!.title}</span>
          <span className="coach-action" style={{ color, borderColor: color }}>{tip!.action}</span>
          <span className="tip-body">{tip!.body}</span>
        </article>
      ))}
      {lastDate && <span className="footnote">Según tu entreno del {lastDate}</span>}
    </section>
  );
}
