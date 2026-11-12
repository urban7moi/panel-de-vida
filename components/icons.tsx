import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 24, children, strokeWidth = 1.8, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CalendarIcon = (p: P) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Base>
);

export const DumbbellIcon = (p: P) => (
  <Base {...p}>
    <path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" />
  </Base>
);

export const SunIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Base>
);

export const CameraIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </Base>
);

export const CheckIcon = (p: P) => (
  <Base strokeWidth={3} {...p}>
    <path d="M5 12l5 5L19 7" />
  </Base>
);

export const PlayIcon = (p: P) => (
  <Base strokeWidth={2} {...p}>
    <path d="M7 5l12 7-12 7z" />
  </Base>
);

export const InfoIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </Base>
);

export const FlatIcon = (p: P) => (
  <Base strokeWidth={2} {...p}>
    <path d="M4 12h16" />
    <path d="M16 8l4 4-4 4" />
  </Base>
);

export const BalanceIcon = (p: P) => (
  <Base strokeWidth={2} {...p}>
    <path d="M12 4v16M5 8h14M5 8l-3 6h6zM19 8l-3 6h6z" />
  </Base>
);
