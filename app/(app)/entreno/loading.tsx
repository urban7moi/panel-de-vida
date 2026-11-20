// Se ve al instante al tocar la pestaña, mientras llega la pantalla.
export default function Loading() {
  return (
    <main className="screen" aria-busy="true">
      <header className="header">
        <div className="header-titles">
          <span className="eyebrow">Recomposición · mantenimiento</span>
          <h1 className="title">Entreno</h1>
        </div>
      </header>
      <div className="skeleton" style={{ height: 330 }} />
      <div className="skeleton" style={{ height: 420 }} />
    </main>
  );
}
