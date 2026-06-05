import next from 'eslint-config-next';

// ESLint 9+ flat config. `next lint` was removed in Next 16, so linting now runs
// via `eslint .` (see package.json). eslint-config-next ships a flat config array
// (next core-web-vitals + next/typescript) that we spread directly.
const eslintConfig = [
  { ignores: ['.next/**', 'node_modules/**', 'public/**'] },
  ...next,
  {
    rules: {
      // New in the React 19 hooks plugin. It fires on intentional, accepted
      // patterns here — a hydration `setMounted(true)` guard and a toast timer —
      // where refactoring to useSyncExternalStore would be over-engineering.
      // Keep it visible as a warning rather than failing the build.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default eslintConfig;
