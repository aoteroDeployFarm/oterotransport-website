/** Decorative chevron accent in the brand yellow. */
export function Chevrons({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 24"
      className={`h-5 w-auto fill-none stroke-brand-yellow ${className}`}
      strokeWidth="5"
    >
      <path d="M4 2l10 10L4 22M24 2l10 10-10 10M44 2l10 10-10 10" />
    </svg>
  );
}
