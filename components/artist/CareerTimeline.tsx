import type { CareerEvent } from "@/lib/types";

type CareerTimelineProps = {
  events: CareerEvent[];
};

export function CareerTimeline({ events }: CareerTimelineProps) {
  const sorted = [...events].sort((a, b) => a.year - b.year);

  return (
    <ol className="relative border-l border-zinc-700 pl-6">
      {sorted.map((event, index) => (
        <li key={`${event.year}-${index}`} className="mb-6 last:mb-0">
          <span
            className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-amber-400"
            aria-hidden
          />
          <time className="font-mono text-sm font-semibold text-amber-400">
            {event.year}
          </time>
          <p className="mt-0.5 font-medium text-zinc-100">{event.label}</p>
          {event.description && (
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              {event.description}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
