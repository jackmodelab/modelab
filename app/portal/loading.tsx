export default function PortalLoading() {
  return (
    <>
      <header className="page-head">
        <div>
          <div className="skel" style={{ width: 180, height: 12, marginBottom: 10 }} />
          <div className="skel" style={{ width: 260, height: 28 }} />
        </div>
      </header>

      <div className="stat-strip">
        {[0, 1, 2].map((i) => (
          <div className="stat-card" key={i}>
            <div className="skel" style={{ width: '60%', height: 12, marginBottom: 12 }} />
            <div className="skel" style={{ width: 44, height: 26 }} />
          </div>
        ))}
      </div>

      <section className="surface" style={{ marginTop: 20, padding: 20 }}>
        {[0, 1, 2, 3].map((i) => (
          <div className="skel" key={i} style={{ height: 14, marginBottom: 14, width: `${85 - i * 10}%` }} />
        ))}
      </section>
    </>
  );
}
