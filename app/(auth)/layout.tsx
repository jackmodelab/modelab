export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="grid-bg" />
      {children}
    </div>
  );
}
