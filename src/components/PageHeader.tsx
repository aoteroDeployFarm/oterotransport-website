import { Chevrons } from "./Chevrons";

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="bg-ink text-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <Chevrons className="mb-5" />
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        {children && <div className="mt-5 max-w-2xl text-lg text-neutral">{children}</div>}
      </div>
    </div>
  );
}
