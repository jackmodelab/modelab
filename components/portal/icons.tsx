/**
 * Inline-SVG icon set for the portal shell. Hand-drawn variants of Feather Icons.
 * Stroke uses currentColor so icons inherit the calling button's text color.
 */
type IconProps = { className?: string };
const SVG = (props: { children: React.ReactNode } & IconProps) => (
  <svg
    className={props.className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {props.children}
  </svg>
);
const SVGBold = (props: { children: React.ReactNode } & IconProps) => (
  <svg
    className={props.className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {props.children}
  </svg>
);

export const Icon = {
  home: (p: IconProps = {}) => (
    <SVG {...p}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h4v-6h6v6h4V10" />
    </SVG>
  ),
  dashboard: (p: IconProps = {}) => (
    <SVG {...p}>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </SVG>
  ),
  calendar: (p: IconProps = {}) => (
    <SVG {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </SVG>
  ),
  clock: (p: IconProps = {}) => (
    <SVG {...p}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </SVG>
  ),
  users: (p: IconProps = {}) => (
    <SVG {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </SVG>
  ),
  file: (p: IconProps = {}) => (
    <SVG {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </SVG>
  ),
  settings: (p: IconProps = {}) => (
    <SVG {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </SVG>
  ),
  search: (p: IconProps = {}) => (
    <SVG {...p}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </SVG>
  ),
  bell: (p: IconProps = {}) => (
    <SVG {...p}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </SVG>
  ),
  plus: (p: IconProps = {}) => (
    <SVGBold {...p}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </SVGBold>
  ),
  chevronL: (p: IconProps = {}) => (
    <SVGBold {...p}>
      <polyline points="15 18 9 12 15 6" />
    </SVGBold>
  ),
  chevronR: (p: IconProps = {}) => (
    <SVGBold {...p}>
      <polyline points="9 18 15 12 9 6" />
    </SVGBold>
  ),
  chevronD: (p: IconProps = {}) => (
    <SVGBold {...p}>
      <polyline points="6 9 12 15 18 9" />
    </SVGBold>
  ),
  logout: (p: IconProps = {}) => (
    <SVG {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </SVG>
  ),
  check: (p: IconProps = {}) => (
    <SVGBold {...p}>
      <polyline points="20 6 9 17 4 12" />
    </SVGBold>
  ),
  packageIcon: (p: IconProps = {}) => (
    <SVG {...p}>
      <path d="M16.5 9.4 7.5 4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </SVG>
  ),
  invoice: (p: IconProps = {}) => (
    <SVG {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </SVG>
  ),
  user: (p: IconProps = {}) => (
    <SVG {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </SVG>
  ),
  pin: (p: IconProps = {}) => (
    <SVG {...p}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </SVG>
  ),
  arrowR: (p: IconProps = {}) => (
    <SVG {...p}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </SVG>
  ),
  download: (p: IconProps = {}) => (
    <SVG {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </SVG>
  ),
  card: (p: IconProps = {}) => (
    <SVG {...p}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </SVG>
  ),
  spark: (p: IconProps = {}) => (
    <SVG {...p}>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </SVG>
  ),
  warn: (p: IconProps = {}) => (
    <SVG {...p}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </SVG>
  ),
  bolt: (p: IconProps = {}) => (
    <SVG {...p}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </SVG>
  ),
  close: (p: IconProps = {}) => (
    <SVGBold {...p}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </SVGBold>
  ),
  edit: (p: IconProps = {}) => (
    <SVG {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </SVG>
  ),
  trash: (p: IconProps = {}) => (
    <SVG {...p}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </SVG>
  ),
};

export type IconKey = keyof typeof Icon;
