/** Visible marker for a business fact that has not been supplied or verified yet. */
export function Placeholder({
  children,
  block = false,
}: {
  children: React.ReactNode;
  block?: boolean;
}) {
  const Tag = block ? "p" : "span";
  return (
    <Tag
      className={`${block ? "block" : "inline-block"} rounded border border-dashed border-brand-red bg-surface px-3 py-2 text-sm font-normal leading-snug text-ink`}
    >
      <strong className="font-semibold">Needs review: </strong>
      {children}
    </Tag>
  );
}
