import { useId } from 'react';

/**
 * Honesty is part of the brand. When a feed is down we say which one and what
 * it costs us — we do not quietly fill the hole with a plausible number.
 */
export function Caveats({ items, title = 'Worth knowing' }: { items: string[]; title?: string }) {
  const headingId = useId();
  if (items.length === 0) return null;
  return (
    <section className="panel caveats" aria-labelledby={headingId}>
      <h2 id={headingId} className="section-title">
        {title}
      </h2>
      <ul className="caveat-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
