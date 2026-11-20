import { PlayIcon } from "../icons";
import type { TodaySession } from "@/lib/training";

export default function TodayCard({ session }: { session: TodaySession }) {
  return (
        <section className="card" aria-labelledby="h-hoy">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div className="header-titles">
              <span className="label-caps">{session.when} toca</span>
              <h2 id="h-hoy" style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{session.label}</h2>
            </div>
            {session.routineTitle && <span className="small muted" style={{ paddingTop: 4, textAlign: "right" }}>{session.routineTitle}</span>}
          </div>

          {session.kind === "rehab" && (
            <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Día de rodilla: haz los ejercicios que te ha pautado tu fisioterapeuta. Sin cargas de pierna hasta que te den el alta.
            </p>
          )}
          {session.kind !== "rehab" && !session.routineId && (
            <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
              No encuentro una rutina de {session.label} en Hevy. Pon &quot;{session.label}&quot; en el nombre de la rutina para que aparezca aquí.
            </p>
          )}
          {session.exercises.length > 0 && (
            <div>
              {session.exercises.map((x, i) => (
                <div className="row" key={x.name + i} style={{ padding: "12px 0" }}>
                  <div className="grow" style={{ gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 500 }}>{x.name}</span>
                    {x.last && <span className="small muted">{x.last}</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{x.target}</span>
                    {x.note && <span className="tiny muted">{x.note}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <a href="hevy://" className="btn-primary"><PlayIcon size={18} />Empezar en Hevy</a>
        </section>
  );
}
