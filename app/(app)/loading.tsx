export default function Loading() {
  return (
    <main className="screen" aria-busy="true">
      <div className="skeleton" style={{ height: 200 }} />
      <div className="skeleton" style={{ height: 320 }} />
    </main>
  );
}
