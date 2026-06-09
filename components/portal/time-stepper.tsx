'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Time bounds (minutes from midnight) ───────────────────────────
const MIN_MINUTES = 4 * 60; // 04:00
const MAX_MINUTES = 23 * 60 + 45; // 23:45
const STEP = 15; // a single press = ±15 minutes
const HOUR = 60; // after a long hold, jump by the hour

// Hold timing: first repeat after a short delay, then tick steadily; once the
// press has been held past LONG_HOLD_MS, each tick jumps a whole hour instead.
const REPEAT_DELAY_MS = 450;
const REPEAT_EVERY_MS = 130;
const LONG_HOLD_MS = 3000;

const clamp = (m: number) => Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, m));
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return clamp((h || 0) * 60 + (m || 0));
};
const toHHMM = (mins: number) => {
  const c = clamp(mins);
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
};

/**
 * A time field stepped with − / + buttons in 15-minute increments.
 *
 * Tap: ±15 min. Press and hold: repeats every 15 min, and once the press passes
 * 3 seconds each repeat jumps a whole hour. Replaces the old scroll-wheel drum.
 */
export function TimeStepper({
  value,
  onChange,
  label,
}: {
  value: string; // "HH:MM"
  onChange: (v: string) => void;
  label: string;
}) {
  const minutes = toMinutes(value);
  // Refs the held-down repeat loop reads/writes without re-subscribing. Kept in
  // sync with the controlled value via an effect (never written during render).
  const valueRef = useRef(minutes);
  useEffect(() => {
    valueRef.current = minutes;
  }, [minutes]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdStartRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Step once in `dir` (+1 / -1). `big` jumps by the hour (long-hold mode).
  const stepOnce = useCallback(
    (dir: 1 | -1, big: boolean) => {
      const delta = (big ? HOUR : STEP) * dir;
      const next = clamp(valueRef.current + delta);
      if (next !== valueRef.current) {
        valueRef.current = next;
        onChange(toHHMM(next));
      }
    },
    [onChange],
  );

  const startHold = useCallback(
    (dir: 1 | -1) => {
      clearTimer();
      holdStartRef.current = Date.now();
      stepOnce(dir, false); // immediate response to the press

      const tick = () => {
        const held = Date.now() - holdStartRef.current;
        stepOnce(dir, held > LONG_HOLD_MS);
        timerRef.current = setTimeout(tick, REPEAT_EVERY_MS);
      };
      timerRef.current = setTimeout(tick, REPEAT_DELAY_MS);
    },
    [clearTimer, stepOnce],
  );

  // Safety: drop any running timer if the component unmounts mid-hold.
  useEffect(() => clearTimer, [clearTimer]);

  const holdProps = (dir: 1 | -1) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      startHold(dir);
    },
    onPointerUp: clearTimer,
    onPointerLeave: clearTimer,
    onPointerCancel: clearTimer,
  });

  return (
    <div className="time-stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="time-stepper-btn"
        aria-label={`${label}: 15 minutes earlier`}
        {...holdProps(-1)}
      >
        −
      </button>
      <span className="time-stepper-val" aria-live="off">
        {toHHMM(minutes)}
      </span>
      <button
        type="button"
        className="time-stepper-btn"
        aria-label={`${label}: 15 minutes later`}
        {...holdProps(1)}
      >
        +
      </button>
    </div>
  );
}

/**
 * Self-contained stepper for plain (non-controlled) forms — keeps its own value
 * in a hidden input named `name` so it posts inside a server-action form.
 */
export function TimeStepperField({
  name,
  defaultValue,
  label,
}: {
  name: string;
  defaultValue: string; // "HH:MM"
  label: string;
}) {
  const [value, setValue] = useState(toHHMM(toMinutes(defaultValue)));
  return (
    <>
      <TimeStepper value={value} onChange={setValue} label={label} />
      <input type="hidden" name={name} value={value} />
    </>
  );
}
