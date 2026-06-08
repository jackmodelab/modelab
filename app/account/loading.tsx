export default function AccountLoading() {
  return (
    <div style={{ padding: '8px 0' }}>
      <div className="skel" style={{ width: 160, height: 12, marginBottom: 10 }} />
      <div className="skel" style={{ width: 240, height: 28, marginBottom: 28 }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <div className="skel" key={i} style={{ height: 14, marginBottom: 14, width: `${90 - i * 8}%` }} />
      ))}
    </div>
  );
}
