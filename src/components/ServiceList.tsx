import { site } from "@/content/site";
import { Placeholder } from "./Placeholder";

export const cardClass =
  "rounded-lg border border-ink/15 border-t-4 border-t-brand-red bg-surface p-6 shadow-sm";

export function ServiceList({ headingLevel = "h3" }: { headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  if (site.services.length === 0) {
    return (
      <div className={cardClass}>
        <Placeholder block>
          List each service {site.name} actually provides (name and a one or two sentence
          description). No services are shown until they are confirmed.
        </Placeholder>
      </div>
    );
  }
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {site.services.map((service) => (
        <li key={service.name} className={cardClass}>
          <Heading className="text-lg font-semibold">{service.name}</Heading>
          <p className="mt-2">{service.description}</p>
        </li>
      ))}
    </ul>
  );
}
