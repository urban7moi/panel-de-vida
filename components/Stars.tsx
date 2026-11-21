export default function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`Importancia ${n} de 5`} style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? "star on" : "star"}>★</span>
      ))}
    </span>
  );
}
