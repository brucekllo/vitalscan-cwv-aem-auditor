export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        aria-label="VitalScan logo"
        role="img"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="7" className="fill-primary" />
        <path
          d="M6 20 L12 20 L15 9 L19 26 L22 14 L26 14"
          stroke="hsl(var(--primary-foreground))"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-semibold tracking-tight text-base leading-none">
        Vital<span className="text-primary">Scan</span>
      </span>
    </span>
  );
}
