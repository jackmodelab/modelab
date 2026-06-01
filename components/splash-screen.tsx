'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ─── Inner flask cavity path ────────────────────────────────────────────────
   Extracted from the second sub-path of path11 in the SVG logo.
   The transform="translate(-26.42965,-65.468466)" converts from the g17-8
   local coordinate system into the SVG viewBox space (0 0 91.238716 121.6098).
   ─────────────────────────────────────────────────────────────────────────── */
const INNER_FLASK_PATH =
  'M 94.578125,72.496094 c -5.31e-4,0.772915 0.13861,1.645085 0.01367,2.363281 ' +
  '-2.772954,0.200358 -5.615828,2.139052 -6.058594,5.017578 ' +
  '-0.207485,12.167197 -0.08708,24.337487 -0.100682,36.505127 ' +
  '0.02733,1.82952 0.24767,3.72478 1.238047,5.30794 ' +
  '6.305186,13.02726 12.673654,26.02478 19.116534,38.9839 ' +
  '1.9494,3.39307 2.74383,7.86717 1.13105,11.62134 ' +
  '-1.72746,4.2199 -5.87964,7.55374 -10.507585,7.76153 ' +
  '-17.796229,0.20668 -35.594727,0.0536 -53.391036,0.16001 ' +
  '-3.168419,-0.0969 -6.688818,-1.24603 -9.023798,-3.66139 ' +
  '-3.319711,-3.32812 -4.67511,-8.66667 -2.916115,-13.08433 ' +
  '6.5257,-13.86298 13.502717,-27.51648 20.155233,-41.331 ' +
  '0.695063,-1.48344 1.436299,-3.01824 1.353971,-4.70297 ' +
  '0.141192,-11.97134 0.07615,-23.946021 0.09519,-35.917821 ' +
  '-0.0355,-2.074275 -0.77858,-4.287431 -2.59107,-5.465368 ' +
  '-1.042957,-0.731594 -2.316561,-1.097417 -3.583171,-1.133999 ' +
  '-0.02456,-0.842077 -0.03661,-1.685617 0.0039,-2.527344 ' +
  '15.01888,-0.01237 30.03776,-0.02474 45.05664,-0.03711 l 0.0055,0.09985 z';

/* Flask outline paths (rendered on top of the liquid) */
const RIM_PATH =
  'm 36.708984,150.23633 c -0.552734,1.19466 -1.105468,2.38932 -1.658203,3.58398 ' +
  '0.06356,0.67347 0.599523,0.9144 1.172069,1.10218 ' +
  '7.997996,3.18608 16.696821,4.48421 25.282901,4.18781 ' +
  '5.034347,-0.17452 10.023341,-1.14024 15.018824,-1.54721 ' +
  '8.768231,-0.84957 17.589359,-1.26616 26.403155,-0.76621 ' +
  '2.67361,0.17583 5.52277,0.4107 8.1211,0.90429 ' +
  '0.54133,-0.4782 0.64956,-0.99431 0.16324,-1.56244 ' +
  '-0.64584,-1.19851 -1.18736,-2.48972 -1.8969,-3.63161 ' +
  '-0.66036,-0.47787 -1.57208,-0.22809 -2.34226,-0.38804 ' +
  '-6.9461,-0.57368 -13.943339,-0.68908 -20.884774,0.0158 ' +
  '-7.713475,0.71543 -15.375331,1.72855 -23.105714,2.24203 ' +
  '-3.888162,0.18871 -7.85983,0.15083 -11.746423,-0.2987 ' +
  '-4.158954,-0.48807 -8.410853,-1.37232 -12.264436,-3.21958 ' +
  '-0.551559,-0.213 -1.06088,-0.67301 -1.592976,-0.81707 ' +
  '-0.223201,0.0649 -0.446402,0.12982 -0.669603,0.19473 z';

const FLASK_OUTLINE_PATH =
  'm 96.849609,65.472656 c -11.144098,0.05056 -22.29252,0.008 -33.438281,0.02278 ' +
  '-5.652676,0.01852 -11.309393,-0.03616 -16.959544,0.02812 ' +
  '-2.130855,0.280799 -3.28996,2.480087 -3.645603,4.397905 ' +
  '-0.361087,2.133671 -0.193524,4.313126 -0.148049,6.462758 ' +
  '0.189943,2.089699 1.088003,4.500688 3.222727,5.268117 ' +
  '0.951616,0.264658 1.945391,0.144249 2.917969,0.138672 ' +
  '0,11.971354 0,23.942702 0,35.914062 ' +
  '-6.986311,14.21321 -14.022069,28.40369 -20.961211,42.63873 ' +
  '-2.792942,6.73758 -1.352065,15.00705 3.617195,20.36085 ' +
  '3.865704,4.30721 9.728423,6.6468 15.492844,6.34812 ' +
  '17.481927,-0.0125 34.96481,0.0349 52.446131,-0.0344 ' +
  '7.132263,-0.32872 13.848453,-4.98904 16.651383,-11.55755 ' +
  '2.39845,-5.43149 2.1475,-11.97903 -0.8113,-17.14797 ' +
  '-6.64501,-13.53461 -13.29003,-27.06923 -19.935042,-40.60384 ' +
  '0.0091,-11.97005 -0.01823,-23.976558 0.01367,-35.923822 ' +
  '1.502105,0.07295 3.303132,0.224678 4.370046,-1.073954 ' +
  '1.761456,-1.841403 1.889196,-4.55111 1.824196,-6.955297 ' +
  '0.0648,-2.505354 -0.0313,-5.337069 -1.87393,-7.257858 ' +
  '-0.729355,-0.718781 -1.767517,-1.072906 -2.783203,-1.025391 z ' +
  'm -2.271484,7.023438 c -5.31e-4,0.772915 0.13861,1.645085 0.01367,2.363281 ' +
  '-2.772954,0.200358 -5.615828,2.139052 -6.058594,5.017578 ' +
  '-0.207485,12.167197 -0.08708,24.337487 -0.100682,36.505127 ' +
  '0.02733,1.82952 0.24767,3.72478 1.238047,5.30794 ' +
  '6.305186,13.02726 12.673654,26.02478 19.116534,38.9839 ' +
  '1.9494,3.39307 2.74383,7.86717 1.13105,11.62134 ' +
  '-1.72746,4.2199 -5.87964,7.55374 -10.507585,7.76153 ' +
  '-17.796229,0.20668 -35.594727,0.0536 -53.391036,0.16001 ' +
  '-3.168419,-0.0969 -6.688818,-1.24603 -9.023798,-3.66139 ' +
  '-3.319711,-3.32812 -4.67511,-8.66667 -2.916115,-13.08433 ' +
  '6.5257,-13.86298 13.502717,-27.51648 20.155233,-41.331 ' +
  '0.695063,-1.48344 1.436299,-3.01824 1.353971,-4.70297 ' +
  '0.141192,-11.97134 0.07615,-23.946021 0.09519,-35.917821 ' +
  '-0.0355,-2.074275 -0.77858,-4.287431 -2.59107,-5.465368 ' +
  '-1.042957,-0.731594 -2.316561,-1.097417 -3.583171,-1.133999 ' +
  '-0.02456,-0.842077 -0.03661,-1.685617 0.0039,-2.527344 ' +
  '15.01888,-0.01237 30.03776,-0.02474 45.05664,-0.03711 l 0.0055,0.09985 z';

/* ─── Tunable constants ──────────────────────────────────────────────────── */
const LIQUID_COLOR = '#B07A3F'; // brand accent (was #F4F5F5)
const FADE_MS = 850; // must match the container's opacity transition

/* ─── Easing ─────────────────────────────────────────────────────────────── */
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* ─── Liquid path builder ────────────────────────────────────────────────── */
function buildLiquidPath(yLevel: number, time: number, amplitude: number): string {
  const x0 = -15;
  const x1 = 110;
  const yFloor = 130; // well below the flask bottom
  const steps = 80;
  const step = (x1 - x0) / steps;

  let d = `M ${x0},${yFloor} L ${x0},${(yLevel + Math.sin(x0 * 0.18 + time * 2.4) * amplitude).toFixed(2)}`;

  for (let i = 0; i <= steps; i++) {
    const x = x0 + i * step;
    const wave =
      Math.sin(x * 0.18 + time * 2.4) * amplitude +
      Math.sin(x * 0.11 + time * 1.65 + 0.9) * amplitude * 0.45;
    d += ` L ${x.toFixed(2)},${(yLevel + wave).toFixed(2)}`;
  }

  d += ` L ${x1},${yFloor} Z`;
  return d;
}

/* ─── Component ──────────────────────────────────────────────────────────── */
export function SplashScreen() {
  const liquidRef = useRef<SVGPathElement>(null);
  const splashRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const finishingRef = useRef(false);
  const [showText, setShowText] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Fade the overlay out and unmount. Shared by the timed end-of-hold and the
  // skip button; guarded so it can only run once.
  const finish = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    cancelAnimationFrame(animRef.current);
    if (splashRef.current) splashRef.current.style.opacity = '0';
    setTimeout(() => {
      try {
        sessionStorage.setItem('modeSplashDone', '1');
      } catch {}
      setMounted(false);
    }, FADE_MS);
  }, []);

  const startAnimation = useCallback(() => {
    let startTime: number | null = null;
    const FILL_MS = 2800;
    const HOLD_MS = 1200;

    // Flask interior bounds in viewBox space
    const FLASK_TOP = 7.5;
    const FLASK_BOTTOM = 113;

    function fillPhase(ts: number) {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const raw = Math.min(elapsed / FILL_MS, 1);
      const progress = easeInOutCubic(raw);
      const time = ts / 1000;

      const yLevel = FLASK_BOTTOM - progress * (FLASK_BOTTOM - FLASK_TOP);
      const amplitude = 3.5 * (1 - progress * 0.72);

      if (liquidRef.current) {
        liquidRef.current.setAttribute('d', buildLiquidPath(yLevel, time, amplitude));
      }

      if (raw < 1) {
        animRef.current = requestAnimationFrame(fillPhase);
      } else {
        setShowText(true);
        let holdStart: number | null = null;

        function holdPhase(ts2: number) {
          if (!holdStart) holdStart = ts2;
          const time2 = ts2 / 1000;

          if (liquidRef.current) {
            liquidRef.current.setAttribute(
              'd',
              buildLiquidPath(FLASK_TOP, time2, 0.45)
            );
          }

          if (ts2 - holdStart < HOLD_MS) {
            animRef.current = requestAnimationFrame(holdPhase);
          } else {
            finish();
          }
        }

        animRef.current = requestAnimationFrame(holdPhase);
      }
    }

    animRef.current = requestAnimationFrame(fillPhase);
  }, [finish]);

  useEffect(() => {
    // Only show once per browser session
    try {
      if (sessionStorage.getItem('modeSplashDone')) return;
    } catch {}

    // Respect reduced-motion: skip the full-screen animation entirely and mark
    // it done so motion-sensitive users land straight on the page.
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      try { sessionStorage.setItem('modeSplashDone', '1'); } catch {}
      return;
    }

    setMounted(true);
    // Small delay so the element is painted before animation starts
    const t = setTimeout(startAnimation, 80);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(animRef.current);
    };
  }, [startAnimation]);

  if (!mounted) return null;

  return (
    <div
      ref={splashRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0E0F11',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: 1,
        transition: 'opacity 0.85s cubic-bezier(0.22, 1, 0.36, 1)',
        userSelect: 'none',
      }}
      role="dialog"
      aria-label="MODE Lab intro"
    >
      {/* Flask SVG */}
      <div style={{ width: 160, flexShrink: 0 }} aria-hidden="true">
        <svg
          viewBox="0 0 91.238716 121.6098"
          width="100%"
          xmlns="http://www.w3.org/2000/svg"
          overflow="visible"
        >
          <defs>
            {/* Clips the liquid fill to the flask interior cavity */}
            <clipPath id="modeFlaskClip" clipPathUnits="userSpaceOnUse">
              <path
                transform="translate(-26.42965,-65.468466)"
                d={INNER_FLASK_PATH}
              />
            </clipPath>
          </defs>

          {/* ── Liquid layer (behind the flask outline) ── */}
          <g clipPath="url(#modeFlaskClip)">
            <path ref={liquidRef} fill={LIQUID_COLOR} d="" />
          </g>

          {/* ── Flask outline (sits on top of the liquid) ── */}
          <g transform="translate(-153.50167,-117.30594)" fill="#FFFFFF">
            <g transform="translate(127.07202,51.837474)">
              {/* Rim / spill shape at the top */}
              <path d={RIM_PATH} />
              {/* Main flask body outline (with hollow interior) */}
              <path d={FLASK_OUTLINE_PATH} />
            </g>
          </g>
        </svg>
      </div>

      {/* Brand wordmark */}
      <div
        style={{
          marginTop: 28,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          fontWeight: 700,
          fontSize: '0.72rem',
          letterSpacing: '0.32em',
          color: '#F4F5F5',
          textTransform: 'uppercase',
          opacity: showText ? 1 : 0,
          transform: showText ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.55s ease, transform 0.55s ease',
        }}
        aria-hidden="true"
      >
        MODE Lab
      </div>

      {/* Tagline */}
      <div
        style={{
          marginTop: 8,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          fontWeight: 400,
          fontSize: '0.6rem',
          letterSpacing: '0.22em',
          color: '#494F57',
          textTransform: 'uppercase',
          opacity: showText ? 1 : 0,
          transition: 'opacity 0.55s ease 0.25s',
        }}
        aria-hidden="true"
      >
        Medical Grade Fitness
      </div>

      {/* Skip — jumps straight to the fade-out */}
      <button
        type="button"
        onClick={finish}
        aria-label="Skip intro"
        style={{
          position: 'absolute',
          bottom: 28,
          right: 28,
          padding: '7px 14px',
          background: 'transparent',
          border: '1px solid rgba(244, 245, 245, 0.22)',
          borderRadius: 999,
          color: '#8B9099',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          fontWeight: 600,
          fontSize: '0.6rem',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Skip
      </button>
    </div>
  );
}
