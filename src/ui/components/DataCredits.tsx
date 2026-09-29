import { DATA_SOURCES } from '@/data/dataSources';

/**
 * Where the data comes from, named, at the foot of the home screen. In demo
 * mode it says so first: the list describes the live app, not what is on
 * screen right now.
 */
export function DataCredits({ usingDemoData }: { usingDemoData: boolean }) {
  return (
    <section className="credits" aria-labelledby="credits-heading">
      <h2 id="credits-heading" className="credits-heading">
        Where the data comes from
      </h2>
      {usingDemoData && <p className="credits-note">Demo data right now. When live, it comes from:</p>}
      <ul className="credits-list">
        {DATA_SOURCES.map((source) => (
          <li key={source.what}>
            <span className="credits-what">{source.what}</span>{' '}
            {source.url ? (
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.who}
              </a>
            ) : (
              <span className="credits-who">{source.who}</span>
            )}
            {!source.live && <span className="credits-static"> · reference, not live</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
