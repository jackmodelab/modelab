'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { submitScreening, type ScreeningActionState } from '@/lib/screening/actions';
import type { ClientScreening } from '@/lib/screening/queries';

const initialState: ScreeningActionState = {};

/* ---------- styles (project uses custom CSS, not Tailwind) ---------- */
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid #e2e2e2',
  borderRadius: 8,
  fontSize: 16, // ≥16px keeps iOS Safari from auto-zooming on focus
  fontFamily: 'inherit',
  background: '#fff',
  color: '#171717',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13.5,
  fontWeight: 500,
  color: '#3f3f3f',
  marginBottom: 6,
};
const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#8a8a8a',
  marginTop: 6,
  lineHeight: 1.45,
};
const errStyle: React.CSSProperties = { fontSize: 12, color: '#c0392b', marginTop: 6 };
const gridTwo: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
};

function Req() {
  return <span style={{ color: '#c0392b' }}> *</span>;
}

function Tag({ kind }: { kind: 'MANDATORY' | 'OPTIONAL' }) {
  const mandatory = kind === 'MANDATORY';
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 9.5,
        letterSpacing: '0.08em',
        fontWeight: 700,
        padding: '3px 7px',
        borderRadius: 4,
        background: mandatory ? '#171717' : '#f0f0f0',
        color: mandatory ? '#fff' : '#777',
      }}
    >
      {kind}
    </span>
  );
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p style={errStyle}>{msg}</p> : null;
}

function Section({
  num,
  title,
  desc,
  children,
}: {
  num: string;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid #efefef', background: '#fafafa' }}>
        <p
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 10.5,
            letterSpacing: '0.1em',
            color: '#9a9a9a',
            margin: 0,
          }}
        >
          SECTION {num}
        </p>
        <h2 style={{ fontSize: 16, fontWeight: 650, margin: '4px 0 0' }}>{title}</h2>
        {desc && <p style={{ ...hintStyle, marginTop: 6 }}>{desc}</p>}
      </div>
      <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {children}
      </div>
    </section>
  );
}

function Question({
  code,
  label,
  kind,
  hint,
  children,
}: {
  code: string;
  label: string;
  kind: 'MANDATORY' | 'OPTIONAL';
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#bbb' }}>
          {code}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
          {label}
          {kind === 'MANDATORY' && <Req />}
        </span>
        <Tag kind={kind} />
      </div>
      {children}
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );
}

function Text({
  name,
  label,
  defaultValue,
  error,
  type = 'text',
  placeholder,
}: {
  name: string;
  label?: string;
  defaultValue?: string;
  error?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      {label && (
        <label htmlFor={name} style={labelStyle}>
          {label}
        </label>
      )}
      <input id={name} name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} style={inputStyle} />
      <FieldError msg={error} />
    </div>
  );
}

function Area({
  name,
  defaultValue,
  error,
  rows = 3,
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  error?: string;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <textarea id={name} name={name} rows={rows} defaultValue={defaultValue} placeholder={placeholder} style={{ ...inputStyle, resize: 'vertical' }} />
      <FieldError msg={error} />
    </div>
  );
}

function Radios({
  name,
  options,
  current,
  error,
}: {
  name: string;
  options: { value: string; label: string }[];
  current: string;
  error?: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => (
          <label
            key={o.value}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 13px',
              border: '1px solid #e2e2e2',
              borderRadius: 8,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            <input type="radio" name={name} value={o.value} defaultChecked={current === o.value} />
            {o.label}
          </label>
        ))}
      </div>
      <FieldError msg={error} />
    </div>
  );
}

function Checks({
  name,
  options,
  current,
  error,
  columns = 2,
}: {
  name: string;
  options: { value: string; label: string }[];
  current: string[];
  error?: string;
  columns?: number;
}) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${360 / columns > 160 ? 200 : 160}px, 1fr))`, gap: 8 }}>
        {options.map((o) => (
          <label
            key={o.value}
            style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5, padding: '4px 0', cursor: 'pointer' }}
          >
            <input type="checkbox" name={name} value={o.value} defaultChecked={current.includes(o.value)} style={{ marginTop: 2 }} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      <FieldError msg={error} />
    </div>
  );
}

function Consent({
  name,
  label,
  kind,
  checked,
  error,
}: {
  name: string;
  label: string;
  kind: 'MANDATORY' | 'OPTIONAL';
  checked: boolean;
  error?: string;
}) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, lineHeight: 1.5 }}>
        <input type="checkbox" name={name} defaultChecked={checked} style={{ marginTop: 3 }} />
        <span>
          {label} {kind === 'MANDATORY' ? <Req /> : <span style={{ color: '#9a9a9a' }}>(optional)</span>}
        </span>
      </label>
      <FieldError msg={error} />
    </div>
  );
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={pending ? { opacity: 0.6 } : undefined}>
      {pending ? 'Submitting…' : editing ? 'Update pre-screening' : 'Submit pre-screening'}{' '}
      <span className="arrow">&rarr;</span>
    </button>
  );
}

/* ---------- option lists (from MODE-LAB INTAKE-001) ---------- */
const SEX = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'intersex', label: 'Intersex' },
  { value: 'prefer_not', label: 'Prefer not to say' },
];
const WORK_PATTERN = [
  { value: 'seated', label: 'Predominantly seated' },
  { value: 'standing', label: 'Predominantly standing' },
  { value: 'physical', label: 'Physically demanding' },
  { value: 'mixed', label: 'Mixed / variable' },
];
const CARDIAC = [
  { value: 'chest_pain', label: 'Chest pain, ache, or discomfort' },
  { value: 'breathlessness', label: 'Unreasonable breathlessness' },
  { value: 'dizziness', label: 'Dizziness, fainting, or blackouts' },
  { value: 'ankle_swelling', label: 'Ankle swelling' },
  { value: 'palpitations', label: 'Heart palpitations / fluttering' },
  { value: 'none', label: 'None of the above' },
];
const CONDITIONS = [
  { value: 'cvd', label: 'Cardiovascular disease' },
  { value: 'hypertension', label: 'High blood pressure / hypertension' },
  { value: 'cholesterol', label: 'High cholesterol' },
  { value: 'diabetes', label: 'Type 1 or Type 2 diabetes' },
  { value: 'prediabetes', label: 'Pre-diabetes / impaired glucose' },
  { value: 'respiratory', label: 'Asthma or respiratory condition' },
  { value: 'kidney', label: 'Kidney disease' },
  { value: 'liver', label: 'Liver disease' },
  { value: 'thyroid', label: 'Thyroid disorder' },
  { value: 'cancer', label: 'Cancer (current or past)' },
  { value: 'osteoporosis', label: 'Osteoporosis / osteopenia' },
  { value: 'arthritis', label: 'Arthritis' },
  { value: 'epilepsy', label: 'Epilepsy / seizure disorder' },
  { value: 'mental_health', label: 'Mental health condition' },
  { value: 'none', label: 'None of the above' },
  { value: 'other', label: 'Other (specify below)' },
];
const YNU = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Unsure' },
];
const TOBACCO = [
  { value: 'never', label: 'Never' },
  { value: 'former_gt12', label: 'Former (quit > 12 months ago)' },
  { value: 'former_lt12', label: 'Former (quit < 12 months ago)' },
  { value: 'current', label: 'Current' },
];
const INJURIES = [
  { value: 'neck', label: 'Neck' },
  { value: 'thoracic', label: 'Mid back (thoracic)' },
  { value: 'lumbar', label: 'Lower back (lumbar)' },
  { value: 'shoulder_l', label: 'Shoulder — left' },
  { value: 'shoulder_r', label: 'Shoulder — right' },
  { value: 'elbow_l', label: 'Elbow — left' },
  { value: 'elbow_r', label: 'Elbow — right' },
  { value: 'wrist_l', label: 'Wrist / hand — left' },
  { value: 'wrist_r', label: 'Wrist / hand — right' },
  { value: 'hip_l', label: 'Hip — left' },
  { value: 'hip_r', label: 'Hip — right' },
  { value: 'knee_l', label: 'Knee — left' },
  { value: 'knee_r', label: 'Knee — right' },
  { value: 'ankle_l', label: 'Ankle / foot — left' },
  { value: 'ankle_r', label: 'Ankle / foot — right' },
  { value: 'head', label: 'Head / concussion' },
  { value: 'none', label: 'None' },
  { value: 'other', label: 'Other' },
];
const PRACTITIONERS = [
  { value: 'gp', label: 'General practitioner' },
  { value: 'physio', label: 'Physiotherapist' },
  { value: 'sports_physician', label: 'Sports physician' },
  { value: 'chiro', label: 'Chiropractor' },
  { value: 'osteo', label: 'Osteopath' },
  { value: 'myo', label: 'Myotherapist / massage' },
  { value: 'dietitian', label: 'Dietitian / nutritionist' },
  { value: 'psych', label: 'Psychologist / counsellor' },
  { value: 'other', label: 'Other' },
  { value: 'none', label: 'None' },
];
const TRAINING_STATUS = [
  { value: 'sedentary', label: 'Sedentary (no structured exercise)' },
  { value: 'recreational', label: 'Recreational (1–2 sessions / wk)' },
  { value: 'active', label: 'Active (3–4 sessions / wk)' },
  { value: 'highly_active', label: 'Highly active (5+ sessions / wk)' },
  { value: 'athlete', label: 'Competitive athlete' },
  { value: 'returning', label: 'Returning after a break' },
];
const RT_EXPERIENCE = [
  { value: 'none', label: 'None / never' },
  { value: 'lt6m', label: '< 6 months' },
  { value: '6_12m', label: '6–12 months' },
  { value: '1_3y', label: '1–3 years' },
  { value: '3_5y', label: '3–5 years' },
  { value: 'gt5y', label: '> 5 years' },
];
const CARDIO_MODES = [
  { value: 'running', label: 'Running' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'rowing', label: 'Rowing' },
  { value: 'walking', label: 'Walking' },
  { value: 'group_hiit', label: 'Group fitness / HIIT' },
  { value: 'sport', label: 'Court / field sport' },
  { value: 'other', label: 'Other' },
];
const LIFTS = [
  { value: 'back_squat', label: 'Back squat' },
  { value: 'front_squat', label: 'Front squat' },
  { value: 'hack_squat', label: 'Hack squat' },
  { value: 'deadlift', label: 'Conventional deadlift' },
  { value: 'rdl', label: 'Romanian deadlift' },
  { value: 'trap_bar', label: 'Trap-bar deadlift' },
  { value: 'bench', label: 'Bench press' },
  { value: 'cg_bench', label: 'Close-grip bench press' },
  { value: 'incline', label: 'Incline press' },
  { value: 'ohp', label: 'Overhead press' },
  { value: 'dip', label: 'Weighted dip' },
  { value: 'chin', label: 'Weighted chin-up' },
  { value: 'row', label: 'Barbell row' },
  { value: 'hip_thrust', label: 'Hip thrust' },
  { value: 'clean', label: 'Power clean / clean variant' },
  { value: 'snatch', label: 'Snatch / snatch variant' },
  { value: 'lunge', label: 'Lunge variations' },
  { value: 'step_up', label: 'Step-up variations' },
  { value: 'none', label: 'None of the above' },
  { value: 'other', label: 'Other' },
];
const PRIMARY_GOAL = [
  { value: 'hypertrophy', label: 'Build muscle / hypertrophy' },
  { value: 'strength', label: 'Increase maximal strength' },
  { value: 'body_comp', label: 'Improve body composition (fat loss)' },
  { value: 'general_health', label: 'Improve general health & fitness' },
  { value: 'sport', label: 'Sport-specific performance' },
  { value: 'return_injury', label: 'Return to activity post-injury' },
  { value: 'movement', label: 'Improve movement quality / mobility' },
  { value: 'cardio', label: 'Improve cardiovascular fitness' },
  { value: 'other', label: 'Other (specify below)' },
];
const PREFERRED_TIME = [
  { value: 'weekday_am', label: 'Weekday mornings' },
  { value: 'weekday_midday', label: 'Weekday middays' },
  { value: 'weekday_pm', label: 'Weekday evenings' },
  { value: 'weekend', label: 'Weekends' },
];
const EQUIPMENT = [
  { value: 'commercial', label: 'Full commercial gym' },
  { value: 'home_full', label: 'Home gym — full kit' },
  { value: 'home_partial', label: 'Home gym — partial' },
  { value: 'bands_bw', label: 'Bands / bodyweight only' },
  { value: 'cardio_only', label: 'Cardiovascular equipment only' },
  { value: 'none', label: 'None / outdoor only' },
];
const STRESS = [
  { value: '1', label: '1 — Very low' },
  { value: '2', label: '2 — Low' },
  { value: '3', label: '3 — Moderate' },
  { value: '4', label: '4 — High' },
  { value: '5', label: '5 — Very high' },
];
const DIET = [
  { value: 'omnivore', label: 'Omnivore — no restriction' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'gluten_free', label: 'Gluten-free' },
  { value: 'dairy_free', label: 'Dairy-free' },
  { value: 'religious', label: 'Religious / cultural' },
  { value: 'other', label: 'Other' },
];

export function ScreeningForm({
  initialData,
  defaultEmail = '',
}: {
  initialData: ClientScreening | null;
  defaultEmail?: string;
}) {
  const [state, formAction] = useFormState(submitScreening, initialState);
  const e = state.fieldErrors ?? {};
  const A = initialData?.answers ?? {};
  const val = (k: string) => (typeof A[k] === 'string' ? (A[k] as string) : '');
  const arr = (k: string) => (Array.isArray(A[k]) ? (A[k] as string[]) : A[k] ? [A[k] as string] : []);
  const on = (k: string) => A[k] === 'on';

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {state.error && (
        <p className="auth-error" role="alert" style={{ background: '#fdecea', border: '1px solid #f5c6c0', color: '#a93226', padding: '12px 14px', borderRadius: 8 }}>
          {state.error}
        </p>
      )}

      {/* SECTION 01 */}
      <Section num="01" title="Client identification" desc="Personal details and emergency contact.">
        <Question code="Q01" label="Full legal name" kind="MANDATORY">
          <div style={gridTwo}>
            <Text name="q01_first_name" label="First name" defaultValue={val('q01_first_name')} error={e.q01_first_name} />
            <Text name="q01_middle" label="Middle name(s)" defaultValue={val('q01_middle')} />
            <Text name="q01_surname" label="Surname" defaultValue={val('q01_surname')} error={e.q01_surname} />
          </div>
        </Question>

        <Question code="Q02" label="Date of birth, sex assigned at birth, and gender identity" kind="MANDATORY" hint="Sex assigned at birth informs strength-ratio norms and physiological reference ranges. Gender identity informs how we address you.">
          <div style={gridTwo}>
            <Text name="q02_dob" label="Date of birth" type="date" defaultValue={val('q02_dob')} error={e.q02_dob} />
            <Text name="q02_gender" label="Gender identity" defaultValue={val('q02_gender')} />
          </div>
          <div style={{ marginTop: 12 }}>
            <span style={labelStyle}>Sex assigned at birth</span>
            <Radios name="q02_sex" options={SEX} current={val('q02_sex')} error={e.q02_sex} />
          </div>
        </Question>

        <Question code="Q03" label="Contact details" kind="MANDATORY">
          <div style={gridTwo}>
            <Text name="q03_mobile" label="Mobile" type="tel" defaultValue={val('q03_mobile')} error={e.q03_mobile} />
            <Text name="q03_email" label="Email" type="email" defaultValue={val('q03_email') || defaultEmail} error={e.q03_email} />
          </div>
          <div style={{ marginTop: 12 }}>
            <Text name="q03_address" label="Residential address" defaultValue={val('q03_address')} />
          </div>
        </Question>

        <Question code="Q04" label="Emergency contact" kind="MANDATORY">
          <div style={gridTwo}>
            <Text name="q04_ec_name" label="Name" defaultValue={val('q04_ec_name')} error={e.q04_ec_name} />
            <Text name="q04_ec_relationship" label="Relationship" defaultValue={val('q04_ec_relationship')} />
            <Text name="q04_ec_mobile" label="Mobile" type="tel" defaultValue={val('q04_ec_mobile')} error={e.q04_ec_mobile} />
          </div>
        </Question>

        <Question code="Q05" label="Occupation and typical work pattern" kind="OPTIONAL" hint="Occupational load influences recovery capacity and session-frequency tolerance.">
          <div style={gridTwo}>
            <Text name="q05_occupation" label="Occupation" defaultValue={val('q05_occupation')} />
            <Text name="q05_hours" label="Hours / week" defaultValue={val('q05_hours')} />
            <Text name="q05_shift" label="Shift work (Y/N)" defaultValue={val('q05_shift')} />
          </div>
          <div style={{ marginTop: 12 }}>
            <Radios name="q05_pattern" options={WORK_PATTERN} current={val('q05_pattern')} />
          </div>
        </Question>
      </Section>

      {/* SECTION 02 */}
      <Section num="02" title="Medical history & screening" desc="Adapted from the ESSA / Sports Medicine Australia adult pre-exercise screening tool. Required for safe prescription.">
        <Question code="Q06" label="Has a medical practitioner ever told you that you have a heart condition, or have you experienced any of the following during physical activity?" kind="MANDATORY">
          <Checks name="q06_cardiac_symptoms" options={CARDIAC} current={arr('q06_cardiac_symptoms')} error={e.q06_cardiac_symptoms} />
          <div style={{ marginTop: 10 }}>
            <Area name="q06_details" defaultValue={val('q06_details')} placeholder="Details (optional)" rows={2} />
          </div>
        </Question>

        <Question code="Q07" label="Do you currently have, or have you been diagnosed with, any of the following conditions?" kind="MANDATORY">
          <Checks name="q07_conditions" options={CONDITIONS} current={arr('q07_conditions')} error={e.q07_conditions} />
          <div style={{ marginTop: 10 }}>
            <Area name="q07_details" defaultValue={val('q07_details')} placeholder="Diagnosis, year, and current management" rows={2} />
          </div>
        </Question>

        <Question code="Q08" label="Current medications, including dosage" kind="MANDATORY" hint="Beta-blockers, antihypertensives, corticosteroids, and anticoagulants affect heart-rate response, blood pressure, and connective-tissue tolerance. Enter 'None' if not applicable.">
          <Area name="q08_medications" defaultValue={val('q08_medications')} error={e.q08_medications} placeholder="List all prescribed and over-the-counter medications" />
        </Question>

        <Question code="Q09" label="Supplements currently in use" kind="OPTIONAL">
          <Area name="q09_supplements" defaultValue={val('q09_supplements')} placeholder="Type, dose, frequency" rows={2} />
        </Question>

        <Question code="Q10" label="Allergies or intolerances (food, medication, latex, other)" kind="MANDATORY">
          <Area name="q10_allergies" defaultValue={val('q10_allergies')} error={e.q10_allergies} placeholder="Specify substance and reaction type — enter 'None' if not applicable" rows={2} />
        </Question>

        <Question code="Q11" label="Surgical history (any surgery, including arthroscopy)" kind="MANDATORY" hint="Post-surgical status influences load tolerance and may require physiotherapy clearance.">
          <Area name="q11_surgical" defaultValue={val('q11_surgical')} error={e.q11_surgical} placeholder="Procedure, date, and current status — enter 'None' if not applicable" rows={2} />
        </Question>

        <Question code="Q12" label="Are you currently pregnant, or have you given birth in the past 12 months?" kind="OPTIONAL" hint="Answer only if applicable.">
          <Radios name="q12_pregnancy" options={YNU} current={val('q12_pregnancy')} />
          <div style={{ marginTop: 10 }}>
            <Area name="q12_details" defaultValue={val('q12_details')} placeholder="If yes — weeks gestation or postpartum, and any clinician advice" rows={2} />
          </div>
        </Question>

        <Question code="Q13" label="Has a first-degree relative experienced a cardiac event before age 55 (male) or 65 (female)?" kind="MANDATORY" hint="APSS Stage 1 — family cardiac risk.">
          <Radios name="q13_family_cardiac" options={YNU} current={val('q13_family_cardiac')} error={e.q13_family_cardiac} />
          <div style={{ marginTop: 10 }}>
            <Area name="q13_details" defaultValue={val('q13_details')} placeholder="If yes — relationship, age at event, and event type" rows={2} />
          </div>
        </Question>
      </Section>

      {/* SECTION 03 */}
      <Section num="03" title="Injury & pain history" desc="Current and prior injuries inform exercise selection, regression, and corrective priorities.">
        <Question code="Q14" label="Tobacco, vaping, and alcohol use" kind="OPTIONAL">
          <span style={labelStyle}>Tobacco / vaping</span>
          <Radios name="q14_tobacco" options={TOBACCO} current={val('q14_tobacco')} />
          <div style={{ marginTop: 12 }}>
            <Text name="q14_alcohol" label="Alcohol — standard drinks / week" defaultValue={val('q14_alcohol')} />
          </div>
        </Question>

        <Question code="Q15" label="Are you currently experiencing pain or restricted movement anywhere in your body?" kind="MANDATORY">
          <Radios name="q15_current_pain" options={YNU} current={val('q15_current_pain')} error={e.q15_current_pain} />
          <div style={{ marginTop: 10 }}>
            <Area name="q15_details" defaultValue={val('q15_details')} placeholder="If yes — location, intensity (0–10), aggravating and easing factors, duration" rows={2} />
          </div>
        </Question>

        <Question code="Q16" label="Past injuries — tick all that apply, then briefly describe" kind="MANDATORY" hint="Asymmetries are weighted in structural-balance assessment and exercise selection.">
          <Checks name="q16_past_injuries" options={INJURIES} current={arr('q16_past_injuries')} error={e.q16_past_injuries} columns={3} />
          <div style={{ marginTop: 10 }}>
            <Area name="q16_details" defaultValue={val('q16_details')} placeholder="For each ticked — year, mechanism, diagnosis, current status, ongoing limitations" rows={2} />
          </div>
        </Question>
      </Section>

      {/* SECTION 04 */}
      <Section num="04" title="Training history & experience" desc="Used to set training age, periodisation framework, and starting loads.">
        <Question code="Q17" label="Are you currently seeing any health practitioners?" kind="OPTIONAL" hint="Used to coordinate care where appropriate, with your consent.">
          <Checks name="q17_practitioners" options={PRACTITIONERS} current={arr('q17_practitioners')} columns={3} />
          <div style={{ marginTop: 10 }}>
            <Area name="q17_details" defaultValue={val('q17_details')} placeholder="Practitioner name(s) and reason for consultation" rows={2} />
          </div>
        </Question>

        <Question code="Q18" label="Has a medical or allied-health practitioner advised you to modify or avoid any form of exercise?" kind="MANDATORY">
          <Radios name="q18_advised_modify" options={YNU} current={val('q18_advised_modify')} error={e.q18_advised_modify} />
          <div style={{ marginTop: 10 }}>
            <Area name="q18_details" defaultValue={val('q18_details')} placeholder="If yes — who advised, what was advised, and when" rows={2} />
          </div>
        </Question>

        <Question code="Q19" label="Current training status" kind="MANDATORY">
          <Radios name="q19_training_status" options={TRAINING_STATUS} current={val('q19_training_status')} error={e.q19_training_status} />
        </Question>

        <Question code="Q20" label="Resistance-training experience" kind="MANDATORY" hint="Determines training age and the appropriate periodisation model.">
          <Radios name="q20_rt_experience" options={RT_EXPERIENCE} current={val('q20_rt_experience')} error={e.q20_rt_experience} />
          <div style={{ ...gridTwo, marginTop: 12 }}>
            <Text name="q20_last_block" label="Last consistent training block (months ago)" defaultValue={val('q20_last_block')} />
            <Text name="q20_modality" label="Primary modality" defaultValue={val('q20_modality')} />
          </div>
        </Question>
      </Section>

      {/* SECTION 05 */}
      <Section num="05" title="Goals, availability & lifestyle" desc="What you want from training, what we have to work with, and the lifestyle factors that affect recovery.">
        <Question code="Q21" label="Cardiovascular / endurance training history" kind="OPTIONAL">
          <Checks name="q21_cardio" options={CARDIO_MODES} current={arr('q21_cardio')} columns={3} />
          <div style={{ ...gridTwo, marginTop: 12 }}>
            <Text name="q21_volume" label="Current weekly volume (hr or km)" defaultValue={val('q21_volume')} />
            <Text name="q21_intensity" label="Typical intensity (Z1–Z5 or RPE)" defaultValue={val('q21_intensity')} />
          </div>
        </Question>

        <Question code="Q22" label="Sport or physical activity you participate in (current or intended)" kind="OPTIONAL" hint="Sport context drives energy-system priorities and transfer-of-training decisions.">
          <Area name="q22_sport" defaultValue={val('q22_sport')} placeholder="Sport, position / discipline, competitive level, season phase" rows={2} />
        </Question>

        <Question code="Q23" label="Tick the lifts you have performed with confident technique in the past 12 months" kind="OPTIONAL" hint="Informs exercise selection for the structural-balance assessment and the first training block.">
          <Checks name="q23_lifts" options={LIFTS} current={arr('q23_lifts')} columns={3} />
        </Question>

        <Question code="Q24" label="Primary training goal — choose ONE" kind="MANDATORY">
          <Radios name="q24_primary_goal" options={PRIMARY_GOAL} current={val('q24_primary_goal')} error={e.q24_primary_goal} />
          <div style={{ marginTop: 10 }}>
            <Text name="q24_other" label="Other / clarification" defaultValue={val('q24_other')} />
          </div>
        </Question>

        <Question code="Q25" label="Secondary goals (rank top 3 if relevant)" kind="OPTIONAL">
          <Area name="q25_secondary" defaultValue={val('q25_secondary')} placeholder="1 = highest priority" rows={2} />
        </Question>

        <Question code="Q26" label="Is there a specific event, deadline, or timeline driving this goal?" kind="OPTIONAL" hint="Drives the macrocycle length and phase structure.">
          <div style={gridTwo}>
            <Text name="q26_event" label="Event / deadline" defaultValue={val('q26_event')} />
            <Text name="q26_target_date" label="Target date" type="date" defaultValue={val('q26_target_date')} />
          </div>
        </Question>

        <Question code="Q27" label="Training availability" kind="MANDATORY">
          <div style={gridTwo}>
            <Text name="q27_days_week" label="Days / week" defaultValue={val('q27_days_week')} error={e.q27_days_week} />
            <Text name="q27_session_min" label="Session length (min)" defaultValue={val('q27_session_min')} error={e.q27_session_min} />
          </div>
          <div style={{ marginTop: 12 }}>
            <span style={labelStyle}>Preferred time of day</span>
            <Checks name="q27_preferred_time" options={PREFERRED_TIME} current={arr('q27_preferred_time')} />
          </div>
        </Question>

        <Question code="Q28" label="Equipment available between supervised sessions" kind="OPTIONAL">
          <Checks name="q28_equipment" options={EQUIPMENT} current={arr('q28_equipment')} columns={3} />
          <div style={{ marginTop: 10 }}>
            <Text name="q28_specify" label="Specify what you have access to" defaultValue={val('q28_specify')} />
          </div>
        </Question>

        <Question code="Q29" label="Sleep — average duration and quality" kind="MANDATORY" hint="Sleep < 7 hr and poor quality reduce recovery capacity and load tolerance.">
          <div style={gridTwo}>
            <Text name="q29_sleep_hours" label="Average hrs / night" defaultValue={val('q29_sleep_hours')} error={e.q29_sleep_hours} />
            <Text name="q29_quality" label="Quality (1–10)" defaultValue={val('q29_quality')} />
            <Text name="q29_trouble" label="Trouble falling / staying asleep (Y/N)" defaultValue={val('q29_trouble')} />
          </div>
        </Question>

        <Question code="Q30" label="Current perceived stress level" kind="MANDATORY">
          <Radios name="q30_stress" options={STRESS} current={val('q30_stress')} error={e.q30_stress} />
        </Question>

        <Question code="Q31" label="Briefly describe a typical day of eating" kind="OPTIONAL" hint="A snapshot only. Detailed nutrition assessment is conducted separately if requested.">
          <Area name="q31_eating" defaultValue={val('q31_eating')} placeholder="Breakfast / lunch / dinner / snacks / fluids — approximate" rows={2} />
        </Question>

        <Question code="Q32" label="Dietary preferences or restrictions" kind="OPTIONAL">
          <Checks name="q32_diet" options={DIET} current={arr('q32_diet')} columns={3} />
          <div style={{ marginTop: 10 }}>
            <Text name="q32_clarify" label="Clarification" defaultValue={val('q32_clarify')} />
          </div>
        </Question>

        <Question code="Q33" label="Typical daily fluid and caffeine intake" kind="OPTIONAL">
          <div style={gridTwo}>
            <Text name="q33_water" label="Water (L / day)" defaultValue={val('q33_water')} />
            <Text name="q33_caffeine" label="Caffeine (mg or servings / day)" defaultValue={val('q33_caffeine')} />
            <Text name="q33_other" label="Other beverages" defaultValue={val('q33_other')} />
          </div>
        </Question>
      </Section>

      {/* SECTION 06 — note only */}
      <Section num="06" title="Baseline biometrics" desc="Recorded by the clinician at your initial session — you do not need to fill these in. Body composition is measured on the Tanita BC-545N. Please attend hydrated, having avoided strenuous exercise for 12 hours and alcohol for 24 hours prior.">
        <p style={hintStyle}>
          Height, body mass, resting HR, blood pressure, body fat %, visceral fat, muscle mass, and metabolic age are
          captured in-session and added to your file.
        </p>
      </Section>

      {/* SECTION 07 */}
      <Section num="07" title="Declaration & consent" desc="Required prior to commencing the initial session.">
        <Consent name="decl_accurate" kind="MANDATORY" checked={on('decl_accurate')} error={e.decl_accurate} label="I confirm that the information provided in this questionnaire is true and complete to the best of my knowledge." />
        <Consent name="decl_understand" kind="MANDATORY" checked={on('decl_understand')} error={e.decl_understand} label="I understand that the information will be used to inform a safe and appropriate exercise prescription and is not a substitute for medical diagnosis or treatment." />
        <Consent name="decl_scope" kind="MANDATORY" checked={on('decl_scope')} error={e.decl_scope} label="I have read and understood the scope of practice — exercise science and strength & conditioning — and that medical diagnosis, prescription medication, and psychological treatment are referred to appropriately qualified practitioners." />
        <Consent name="decl_anthro" kind="MANDATORY" checked={on('decl_anthro')} error={e.decl_anthro} label="I consent to having anthropometric measurements (height, mass, body composition via Tanita BC-545N) taken at baseline and at agreed review points." />
        <Consent name="decl_coordinate" kind="OPTIONAL" checked={on('decl_coordinate')} label="I consent to MODE Lab coordinating, where clinically appropriate and with my explicit permission, with my treating practitioners." />
        <Consent name="decl_reports" kind="OPTIONAL" checked={on('decl_reports')} label="I would like to receive periodic written progress reports summarising assessment data and training outcomes." />
      </Section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 8 }}>
        <SubmitButton editing={!!initialData} />
        <span style={hintStyle}>By submitting, your responses are stored securely against your client file.</span>
      </div>
    </form>
  );
}
