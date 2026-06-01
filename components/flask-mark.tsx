/** The MODE Lab flask mark (company logo). Served from /public/assets/img. */
export function FlaskMark({ className = 'flask' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/assets/img/flask-logo.svg" className={className} alt="" aria-hidden="true" />;
}
