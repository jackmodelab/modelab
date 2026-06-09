'use client';

import { useState, useCallback, useRef, useTransition } from 'react';
import { deleteAvailability, toggleAvailability, updateAvailability } from '@/lib/portal/actions';
import { TimeStepper } from '@/components/portal/time-stepper';

export type AvailBlockLocation = { id: string; name: string };

export type AvailBlockData = {
  id: string;
  start_time: string;
  end_time: string;
  location_id: string | null;
  is_active: boolean;
};

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
          <TimeStepper value={startTime} onChange={handleStart} label="Start time" />
          <span className="avail-live-dash" aria-hidden="true">–</span>
          <TimeStepper value={endTime}   onChange={handleEnd}   label="End time" />

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
