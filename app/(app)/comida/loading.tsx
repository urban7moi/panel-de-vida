export default function Loading() {
  return (
    <main className="screen" aria-busy="true">
      <header className="header">
        <div className="header-titles">
          <span className="eyebrow">&nbsp;</span>
          <h1 className="title">Alimentación</h1>
        </div>
      </header>
      <div className="skeleton" style={{ height: 220 }} />
      <div className="skeleton" style={{ height: 320 }} />
    </main>
  );
}
