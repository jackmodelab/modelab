import { format, parseISO } from 'date-fns';
import { reportTypeLabel } from '@/lib/reports/templates';
import type { ClientReport } from '@/lib/reports/queries';

/**
 * The rendered, printable report — shared by the staff and member views so the
 * on-screen, printed and saved-PDF output are identical. Wrapped in `.report-doc`
 * which the print stylesheet promotes to the whole page (hiding the app shell).
 */
export function ReportDocument({
  report,
  clientName,
  authorName,
}: {
  report: ClientReport;
  clientName: string;
  authorName?: string | null;
}) {
  const { metrics, sections } = report.content;
  const dateLine = report.published_at ?? report.created_at;

  const period =
    report.period_start || report.period_end
      ? [report.period_start, report.period_end]
          .filter(Boolean)
          .map((d) => format(parseISO(d as string), 'dd MMM yyyy'))
          .join(' – ')
      : null;

  return (
    <article className="report-doc">
      <header className="report-masthead">
        <div className="report-brand">
          <span className="report-brand-mark">MODE&nbsp;LAB</span>
          <span className="report-brand-sub">{reportTypeLabel(report.type)}</span>
        </div>
        <h1 className="report-title">{report.title}</h1>
        <div className="report-meta">
          <span>
            <span className="report-meta-k">Client</span>
            {clientName}
          </span>
          {period && (
            <span>
              <span className="report-meta-k">Period</span>
              {period}
            </span>
          )}
          <span>
            <span className="report-meta-k">Date</span>
            {format(parseISO(dateLine), 'dd MMM yyyy')}
          </span>
          {authorName && (
            <span>
              <span className="report-meta-k">Prepared by</span>
              {authorName}
            </span>
          )}
        </div>
      </header>

      {report.summary && (
        <p className="report-summary">{report.summary}</p>
      )}

      {metrics.length > 0 && (
        <div className="report-metrics">
          {metrics.map((m, i) => (
            <div className="report-metric" key={i}>
              <div className="report-metric-k">{m.label}</div>
              <div className="report-metric-v">
                {m.value || '—'}
                {m.unit ? <span className="report-metric-u">{m.unit}</span> : null}
              </div>
              {m.change ? <div className="report-metric-c">{m.change}</div> : null}
            </div>
          ))}
        </div>
      )}

      <div className="report-sections">
        {sections.map((s, i) => (
          <section className="report-section" key={i}>
            {s.heading && <h2 className="report-section-head">{s.heading}</h2>}
            {s.body && (
              <div className="report-section-body">
                {s.body.split(/\n{2,}/).map((para, j) => (
                  <p key={j}>
                    {para.split('\n').map((line, k) => (
                      <span key={k}>
                        {line}
                        {k < para.split('\n').length - 1 ? <br /> : null}
                      </span>
                    ))}
                  </p>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <footer className="report-footer">
        <span>MODE Lab · {clientName}</span>
        <span>{report.title}</span>
      </footer>
    </article>
  );
}
