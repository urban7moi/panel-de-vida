import { FlameIcon } from "./icons";

/** Racha: icono de llama, número y texto. Si es 0, anima a empezar. */
export default function StreakPill({ n, unit, label, empty }: { n: number; unit: [string, string]; label: string; empty: string }) {
  return (
    <div className={n > 0 ? "streak on" : "streak"}>
      <span className="streak-icon"><FlameIcon size={20} /></span>
      <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        {n > 0 ? (
          <>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{n} {n === 1 ? unit[0] : unit[1]}</span>
            <span className="tiny muted">{label}</span>
          </>
        ) : (
          <span className="small muted">{empty}</span>
        )}
      </span>
    </div>
  );
}
