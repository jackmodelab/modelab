'use client';

import { useState, useCallback, useRef, useTransition } from 'react';
import { deleteAvailability, toggleAvailability, updateAvailability } from '@/lib/portal/actions';

export type AvailBlockLocation = { id: string; name: string };

export type AvailBlockData = {
  id: string;
  start_time: string;
  end_time: string;
  location_id: string | null;
  is_active: boolean;
};

// ── Time value sets ───────────────────────────────────────────────
const HOURS   = Array.from({ length: 20 }, (_, i) => String(i + 4).padStart(2, '0')); // 04–23
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

/** Nearest option to a raw value (handles times not on the 5-min grid). */
function nearest(value: string, options: string[]): string {
  if (options.includes(value)) return value;
  const n = parseInt(value, 10);
  return options.reduce((best, opt) =>
    Math.abs(parseInt(opt, 10) - n) < Math.abs(parseInt(best, 10) - n) ? opt : best,
  );
}

// ── Single scroll drum ────────────────────────────────────────────
function Drum({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  label: string;
}) {
  const idx = options.indexOf(value);
  const prev = idx > 0 ? options[idx - 1] : null;
  const next = idx < options.length - 1 ? options[idx + 1] : null;

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const dir = e.deltaY > 0 ? 1 : -1;
      const newIdx = Math.max(0, Math.min(options.length - 1, idx + dir));
      if (newIdx !== idx) onChange(options[newIdx]);
    },
    [idx, options, onChange],
  );

  return (
    <div
      className="time-drum"
      onWheel={handleWheel}
      role="spinbutton"
      aria-valuenow={idx}
      aria-valuemin={0}
      aria-valuemax={options.length - 1}
      aria-label={label}
      aria-valuetext={value}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const i = Math.max(0, idx - 1);
          if (i !== idx) onChange(options[i]);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const i = Math.min(options.length - 1, idx + 1);
          if (i !== idx) onChange(options[i]);
        }
      }}
    >
      {/* Click ghost above to go back one step */}
      <button
        type="button"
        className="time-drum-ghost"
        onClick={() => prev && onChange(prev)}
        tabIndex={-1}
        aria-hidden="true"
      >
        {prev ?? ''}
      </button>

      <div className="time-drum-val" aria-hidden="true">{value}</div>

      {/* Click ghost below to advance one step */}
      <button
        type="button"
        className="time-drum-ghost"
        onClick={() => next && onChange(next)}
        tabIndex={-1}
        aria-hidden="true"
      >
        {next ?? ''}
      </button>
    </div>
  );
}

// ── HH:MM picker composed of two drums ───────────────────────────
function TimeScrollPicker({
  value,
  onChange,
  label,
}: {
  value: string; // "HH:MM"
  onChange: (v: string) => void;
  label: string;
}) {
  const [hh, mm] = value.split(':');
  const safeHh = nearest(hh, HOURS);
  const safeMm = nearest(mm, MINUTES);

  return (
    <div className="time-scroll-picker" aria-label={label}>
      <Drum
        value={safeHh}
        options={HOURS}
        onChange={(v) => onChange(`${v}:${safeMm}`)}
        label="Hour"
      />
      <span className="time-scroll-sep" aria-hidden="true">:</span>
      <Drum
        value={safeMm}
        options={MINUTES}
        onChange={(v) => onChange(`${safeHh}:${v}`)}
        label="Minute"
      />
    </div>
  );
}

// ── Location label helper (client-side) ──────────────────────────
function locDisplay(id: string, locations: AvailBlockLocation[]): string {
  if (id === 'any') return 'Any location';
  return locations.find((l) => l.id === id)?.name ?? 'Any location';
}

// ── Main block row ────────────────────────────────────────────────
export function AvailBlock({
  block,
  locations,
}: {
  block: AvailBlockData;
  locations: AvailBlockLocation[];
}) {
  const [startTime, setStartTime]   = useState(block.start_time.slice(0, 5));
  const [endTime,   setEndTime]     = useState(block.end_time.slice(0, 5));
  const [locationId, setLocationId] = useState(block.location_id ?? 'any');
  const [confirming, setConfirming] = useState(false);
  const [saveState, setSaveState]   = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [, startTransition]         = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced auto-save — fires 650ms after the last scroll tick.
  const scheduleSave = useCallback(
    (newStart: string, newEnd: string, newLoc: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (newStart >= newEnd) {
        setSaveState('error');
        return;
      }

      setSaveState('saving');
      debounceRef.current = setTimeout(() => {
        startTransition(async () => {
          const fd = new FormData();
          fd.set('id', block.id);
          fd.set('start_time', newStart);
          fd.set('end_time',   newEnd);
          fd.set('location_id', newLoc);
          await updateAvailability(fd);
          setSaveState('saved');
          setTimeout(() => setSaveState('idle'), 2000);
        });
      }, 650);
    },
    [block.id, startTransition],
  );

  const handleStart = (v: string) => { setStartTime(v); scheduleSave(v, endTime, locationId); };
  const handleEnd   = (v: string) => { setEndTime(v);   scheduleSave(startTime, v, locationId); };
  const handleLoc   = (v: string) => { setLocationId(v); scheduleSave(startTime, endTime, v); };

  return (
    <>
      <div className={`avail-live-row${block.is_active ? '' : ' is-off'}`}>

        {/* Always-visible time pickers */}
        <div className="avail-live-times">
          <TimeScrollPicker value={startTime} onChange={handleStart} label="Start time" />
          <span className="avail-live-dash" aria-hidden="true">–</span>
          <TimeScrollPicker value={endTime}   onChange={handleEnd}   label="End time" />

          {saveState === 'saving' && (
            <span className="avail-save-dot saving" aria-live="polite" aria-label="Saving" />
          )}
          {saveState === 'saved' && (
            <span className="avail-save-dot saved"  aria-live="polite" aria-label="Saved" />
          )}
          {saveState === 'error' && (
            <span className="avail-save-err" aria-live="polite">End must be after start</span>
          )}
        </div>

        {/* Location — always-visible select */}
        <select
          className="avail-live-loc"
          value={locationId}
          onChange={(e) => handleLoc(e.target.value)}
          aria-label="Location"
        >
          <option value="any">Any location</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        {/* Status pill + actions */}
        <div className="avail-live-actions">
          <span className={`pill ${block.is_active ? 'pill--ok' : ''}`}>
            {block.is_active ? 'Open' : 'Off'}
          </span>

          <form action={toggleAvailability} style={{ display: 'contents' }}>
            <input type="hidden" name="id"   value={block.id} />
            <input type="hidden" name="next" value={(!block.is_active).toString()} />
            <button className="avail-block-btn" type="submit">
              {block.is_active ? 'Turn off' : 'Turn on'}
            </button>
          </form>

          <button
            className="avail-block-btn is-danger"
            type="button"
            onClick={() => setConfirming(true)}
          >
            Remove
          </button>
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirming && (
        <div
          className="modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirming(false); }}
        >
          <div className="p-modal" role="dialog" aria-modal="true" aria-labelledby="avail-confirm-title">
            <h3 id="avail-confirm-title">Remove this block?</h3>
            <p>
              {startTime} – {endTime} · {locDisplay(locationId, locations)} will be permanently
              deleted. You can re-add it any time.
            </p>
            <div className="p-modal-actions">
              <button className="btn btn--ghost" type="button" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <form action={deleteAvailability}>
                <input type="hidden" name="id" value={block.id} />
                <button className="btn btn--danger" type="submit">Remove block</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
