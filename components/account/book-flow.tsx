'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { Icon } from '@/components/portal/icons';
import { requestBooking, requestCustomBooking } from '@/lib/account/actions';

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

/** Changeover buffer reserved after a session before the next slot opens. */
const BUFFER_MINUTES = 15;

/**
 * The 30- and 45-minute training sessions carry a 15-minute changeover buffer;
 * other services (e.g. the body-comp scan) get none. The buffer is reserved
 * after the session so back-to-back hourly slots stay clear.
 */
export function bufferFor(serviceMin: number) {
  return serviceMin === 30 || serviceMin === 45 ? BUFFER_MINUTES : 0;
}

/**
 * Generate on-the-hour candidate start slots that fit `serviceMin` plus its
 * changeover buffer inside an availability block. Slots start at the top of the
 * hour and step hourly.
 */
function slotsForBlock(b: FlowAvailabilityBlock, serviceMin: number) {
  const need = serviceMin + bufferFor(serviceMin);
  const out: number[] = [];
  // First slot on/after the block start, snapped up to the top of the hour.
  const first = Math.ceil(b.startMinute / 60) * 60;
  for (let t = first; t + need <= b.endMinute; t += 60) out.push(t);
  return out;
}

/**
 * Shown at the confirm step (and the custom-time form) for members who haven't
 * completed the health pre-screening. Screening is optional for booking: they can
 * complete it now, or tick the box to do it in person at their first session. The
 * checkbox carries `screening_in_person` with the booking form so the server lets
 * the booking through and flags it for the coach.
 */
function ScreeningOptIn({
  inPerson,
  onChange,
}: {
  inPerson: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ marginTop: 20, background: '#fff8e6', border: '1px solid #f3e0a8', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontWeight: 650, fontSize: 14, color: '#7a5e10' }}>
        New client health pre-screening
      </div>
      <div style={{ fontSize: 13, color: '#8a6d1a', marginTop: 2, lineHeight: 1.5 }}>
        We recommend completing the short health questionnaire first — it helps your coach prescribe
        safely. You can do it now, or complete it in person at your first session.
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
        <Link className="btn btn--ghost" href="/account/screening">
          Complete pre-screening
        </Link>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#7a5e10', cursor: 'pointer' }}>
          <input
            type="checkbox"
            name="screening_in_person"
            checked={inPerson}
            onChange={(e) => onChange(e.target.checked)}
          />
          I&apos;ll complete it in person at my first session
        </label>
      </div>
    </div>
  );
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

  // New clients may book before completing the health pre-screening by opting to
  // do it in person at their first session. Tracks that opt-in for both the
  // standard confirm step and the custom-time request.
  const [screenInPerson, setScreenInPerson] = useState(false);

  // "Request a specific time" — an off-grid request the trainer must accept.
  const [showCustom, setShowCustom] = useState(false);
  const [customCoachId, setCustomCoachId] = useState<string>('');
  const [customDate, setCustomDate] = useState<string>('');
  const [customTime, setCustomTime] = useState<string>('');
  const [customNote, setCustomNote] = useState<string>('');

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

  // Custom (off-grid) request — combine the date + time inputs in the browser's
  // local zone (clinic time), mirroring the grid path above.
  const customStartsAtIso = (() => {
    if (!customDate || !customTime) return '';
    const d = new Date(`${customDate}T${customTime}`);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  })();
  const customValid = !!customCoachId && !!customStartsAtIso && new Date(customStartsAtIso) > new Date();

  const openCustom = () => {
    if (!customDate) setCustomDate(format(days[dayIdx], 'yyyy-MM-dd'));
    if (!customCoachId && coaches.length === 1) setCustomCoachId(coaches[0].id);
    setShowCustom(true);
  };

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

            {/* Off-grid: request a specific time the trainer must accept. */}
            <div className="custom-req">
              {!showCustom ? (
                <button type="button" className="custom-req-open" onClick={openCustom}>
                  Can&apos;t find a time? <strong>Request a specific time →</strong>
                </button>
              ) : (
                <form action={requestCustomBooking} className="custom-req-form">
                  <input type="hidden" name="service_id" value={service.id} />
                  <input type="hidden" name="location_id" value={location.id} />
                  <input type="hidden" name="starts_at" value={customStartsAtIso} />

                  <div className="custom-req-head">
                    <div>
                      <div className="custom-req-title">Request a specific time</div>
                      <div className="custom-req-sub">
                        Outside the listed hours — your trainer will review and accept or decline.
                      </div>
                    </div>
                    <button type="button" className="custom-req-close" onClick={() => setShowCustom(false)}>
                      <Icon.close />
                    </button>
                  </div>

                  <div className="custom-req-grid">
                    <label className="fld">
                      <span>Coach</span>
                      <select
                        name="coach_id"
                        value={customCoachId}
                        onChange={(e) => setCustomCoachId(e.target.value)}
                        required
                      >
                        <option value="">Select a coach…</option>
                        {coaches.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="fld">
                      <span>Date</span>
                      <input
                        type="date"
                        value={customDate}
                        min={format(days[0], 'yyyy-MM-dd')}
                        onChange={(e) => setCustomDate(e.target.value)}
                        required
                      />
                    </label>
                    <label className="fld">
                      <span>Time</span>
                      <input
                        type="time"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        required
                      />
                    </label>
                  </div>

                  <label className="fld" style={{ marginTop: 12 }}>
                    <span>Note for your trainer (optional)</span>
                    <textarea
                      name="note"
                      rows={2}
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      maxLength={500}
                      placeholder="e.g. I can only make early mornings this week."
                    />
                  </label>

                  {!screeningComplete && (
                    <ScreeningOptIn inPerson={screenInPerson} onChange={setScreenInPerson} />
                  )}

                  <div style={{ marginTop: 14 }}>
                    <button
                      className="btn"
                      type="submit"
                      disabled={!customValid || (!screeningComplete && !screenInPerson)}
                    >
                      Send request to trainer <Icon.arrowR />
                    </button>
                  </div>
                </form>
              )}
            </div>
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
                The studio will confirm your request and email you the calendar invite. Payment is settled in
                studio at your session — card, cash or transfer.
              </p>
            </div>

            {!screeningComplete && (
              <ScreeningOptIn inPerson={screenInPerson} onChange={setScreenInPerson} />
            )}

            <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" type="submit" disabled={!screeningComplete && !screenInPerson}>
                Send request <Icon.arrowR />
              </button>
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
