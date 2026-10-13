/** Section title with the red accent bar used across the site. */
export function SectionHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="border-l-4 border-brand-red pl-4 text-2xl font-bold tracking-tight sm:text-3xl"
    >
      {children}
    </h2>
  );
}
