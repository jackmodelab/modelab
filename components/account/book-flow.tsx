'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { Icon } from '@/components/portal/icons';
import { requestBooking } from '@/lib/account/actions';

export type FlowService = { id: string; name: string; durationMinutes: number; blurb: string | null };
export type FlowLocation = { id: string; name: string; address: string };
export type FlowCoach = { id: string; name: string; initials: string; title: string | null; bio: string | null };
export type FlowAvailabilityBlock = {
  coachId: string;
  locationId: string | null;
  weekday: number;
  startMinute: number;
  endMinute: number;
};

const STEPS = ['Service', 'Location', 'Coach + time', 'Confirm'] as const;
type StepIndex = 0 | 1 | 2 | 3;

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function minutesToHHMM(min: number) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

function minutesTo12h(min: number) {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h24 >= 12 ? 'pm' : 'am';
  const h = h24 % 12 || 12;
  return `${h}:${pad(m)}${ampm}`;
}

/**
 * Generate 15-minute candidate start slots that fit `service.durationMinutes`
 * inside an availability block.
 */
function slotsForBlock(b: FlowAvailabilityBlock, serviceMin: number) {
  const out: number[] = [];
  for (let t = b.startMinute; t + serviceMin <= b.endMinute; t += 15) out.push(t);
  return out;
}

export function BookFlow({
  services,
  locations,
  coaches,
  availability,
  screeningComplete,
}: {
  services: FlowService[];
  locations: FlowLocation[];
  coaches: FlowCoach[];
  availability: FlowAvailabilityBlock[];
  screeningComplete: boolean;
}) {
  const [step, setStep] = useState<StepIndex>(0);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [dayIdx, setDayIdx] = useState<number>(0); // 0..13 from today+1
  const [coachId, setCoachId] = useState<string | null>(null);
  const [slotMin, setSlotMin] = useState<number | null>(null);

  const service = useMemo(() => services.find((s) => s.id === serviceId) ?? null, [serviceId, services]);
  const location = useMemo(() => locations.find((l) => l.id === locationId) ?? null, [locationId, locations]);
  const coach = useMemo(() => coaches.find((c) => c.id === coachId) ?? null, [coachId, coaches]);

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => addDays(today, i + 1));
  }, []);

  // For step 3: candidate slots per coach for the selected day + location + service.
  const slotsByCoach = useMemo(() => {
    if (!service || !location) return new Map<string, number[]>();
    const day = days[dayIdx];
    const weekday = day.getDay();
    const m = new Map<string, number[]>();
    for (const c of coaches) {
      const blocks = availability.filter(
        (b) =>
          b.coachId === c.id &&
          b.weekday === weekday &&
          (b.locationId === null || b.locationId === location.id),
      );
      const all = blocks.flatMap((b) => slotsForBlock(b, service.durationMinutes));
      if (all.length) m.set(c.id, Array.from(new Set(all)).sort((a, b) => a - b));
    }
    return m;
  }, [availability, coaches, dayIdx, days, location, service]);

  const dayCounts = useMemo(() => {
    if (!service || !location) return days.map(() => 0);
    return days.map((d) => {
      const weekday = d.getDay();
      return availability.reduce((sum, b) => {
        if (b.weekday !== weekday) return sum;
        if (b.locationId !== null && b.locationId !== location.id) return sum;
        return sum + slotsForBlock(b, service.durationMinutes).length;
      }, 0);
    });
  }, [availability, days, location, service]);

  const canNext: Record<StepIndex, boolean> = {
    0: !!serviceId,
    1: !!locationId,
    2: !!coachId && slotMin != null,
    3: false,
  };

  const stepperItem = (i: StepIndex) => {
    const isActive = step === i;
    const isDone = step > i;
    return (
      <button
        key={i}
        type="button"
        className={`flow-step ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
        onClick={() => {
          if (i <= step) setStep(i);
        }}
      >
        <span className="n">{isDone ? <Icon.check /> : i + 1}</span>
        {STEPS[i]}
      </button>
    );
  };

  // Build datetime string for hidden form input (yyyy-MM-ddTHH:mm)
  const startsAtIso = (() => {
    if (slotMin == null) return '';
    const d = new Date(days[dayIdx]);
    d.setHours(Math.floor(slotMin / 60), slotMin % 60, 0, 0);
    return d.toISOString();
  })();

  return (
    <div className="flow">
      <aside className="flow-side">
        {([0, 1, 2, 3] as StepIndex[]).map(stepperItem)}
      </aside>

      <div className="flow-body">
        {step === 0 && (
          <>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Pick a service.</h2>
            <div className="svc-grid">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`svc-card ${serviceId === s.id ? 'is-selected' : ''}`}
                  onClick={() => setServiceId(s.id)}
                >
                  <div className="svc-name">{s.name}</div>
                  {s.blurb && <div className="svc-blurb">{s.blurb}</div>}
                  <div className="svc-foot">
                    <span className="svc-duration">{s.durationMinutes} min</span>
                    <span className="svc-badge">Select →</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Where would you like to train?</h2>
            <div className="loc-row">
              {locations.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`loc-chip ${locationId === l.id ? 'is-selected' : ''}`}
                  onClick={() => setLocationId(l.id)}
                >
                  <div className="loc-name">
                    <Icon.pin />
                    {l.name}
                  </div>
                  <div className="loc-addr">{l.address}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && service && location && (
          <>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Pick a day, coach + time.</h2>
            <div className="day-strip">
              {days.map((d, i) => {
                const count = dayCounts[i];
                return (
                  <button
                    key={i}
                    type="button"
                    className={`day-tile ${dayIdx === i ? 'is-selected' : ''}`}
                    onClick={() => {
                      setDayIdx(i);
                      setSlotMin(null);
                      setCoachId(null);
                    }}
                    disabled={count === 0}
                  >
                    <div className="dow">{format(d, 'EEE')}</div>
                    <div className="dnum">{format(d, 'd')}</div>
                    <div className={`count ${count === 0 ? 'is-empty' : ''}`}>{count === 0 ? 'None' : `${count}`}</div>
                  </button>
                );
              })}
            </div>

            {slotsByCoach.size === 0 ? (
              <div className="slot-empty">No times available on this day. Try another.</div>
            ) : (
              Array.from(slotsByCoach.entries()).map(([cid, slots]) => {
                const c = coaches.find((x) => x.id === cid);
                if (!c) return null;
                return (
                  <div key={cid} className="coach-block">
                    <div className="coach-block-head">
                      <div className="coach-avatar">{c.initials}</div>
                      <div>
                        <div className="coach-name">{c.name}</div>
                        {c.title && <div className="coach-title">{c.title}</div>}
                      </div>
                      {c.bio && <div className="coach-bio">{c.bio}</div>}
                    </div>
                    <div className="slot-grid">
                      {slots.map((min) => {
                        const isSel = coachId === cid && slotMin === min;
                        return (
                          <button
                            key={min}
                            type="button"
                            className={`slot ${isSel ? 'is-selected' : ''}`}
                            onClick={() => {
                              setCoachId(cid);
                              setSlotMin(min);
                            }}
                          >
                            {minutesToHHMM(min)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {step === 3 && service && location && coach && slotMin != null && (
          <form action={requestBooking}>
            <input type="hidden" name="service_id" value={service.id} />
            <input type="hidden" name="location_id" value={location.id} />
            <input type="hidden" name="coach_id" value={coach.id} />
            <input type="hidden" name="starts_at" value={startsAtIso} />

            <div className="confirm-card">
              <div className="confirm-headline">
                {service.name} <span style={{ color: 'var(--slate-soft)', fontWeight: 400 }}>at</span> {minutesTo12h(slotMin)}
              </div>
              <div className="confirm-kv">
                <div className="confirm-k">Coach</div>
                <div className="confirm-v">{coach.name}</div>
                <div className="confirm-k">Where</div>
                <div className="confirm-v">{location.name} · {location.address}</div>
                <div className="confirm-k">Day</div>
                <div className="confirm-v">{format(days[dayIdx], 'EEEE dd MMM yyyy')}</div>
                <div className="confirm-k">Duration</div>
                <div className="confirm-v">{service.durationMinutes} min</div>
              </div>
              <div className="confirm-bill">
                <div>
                  <div className="confirm-bill-l">Charged via</div>
                  <div className="confirm-bill-v">Casual — confirmed by the studio</div>
                </div>
                <span className="pill">Request</span>
              </div>
              <p style={{ color: 'var(--slate)', fontSize: 12.5, lineHeight: 1.55 }}>
                The studio will confirm your request and email you the calendar invite. (Self-serve checkout lands
                once Stripe is wired up.)
              </p>
            </div>

            {!screeningComplete && (
              <div style={{ marginTop: 20, background: '#fff8e6', border: '1px solid #f3e0a8', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontWeight: 650, fontSize: 14, color: '#7a5e10' }}>
                  Complete your pre-screening to confirm
                </div>
                <div style={{ fontSize: 13, color: '#8a6d1a', marginTop: 2, lineHeight: 1.5 }}>
                  You can choose your service, coach, and time freely — but the new client health
                  questionnaire must be completed before a booking can be confirmed.
                </div>
              </div>
            )}

            <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {screeningComplete ? (
                <button className="btn" type="submit">
                  Send request <Icon.arrowR />
                </button>
              ) : (
                <Link className="btn" href="/account/screening">
                  Complete pre-screening <Icon.arrowR />
                </Link>
              )}
              <button className="btn btn--ghost" type="button" onClick={() => setStep(2)}>
                ← Change time
              </button>
            </div>
          </form>
        )}

        {/* Step controls */}
        {step < 3 && (
          <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => setStep((s) => (s > 0 ? ((s - 1) as StepIndex) : s))}
              disabled={step === 0}
            >
              ← Back
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => setStep((s) => ((s + 1) as StepIndex))}
              disabled={!canNext[step]}
            >
              Next <Icon.arrowR />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
