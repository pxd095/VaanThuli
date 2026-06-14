export function StatsBar({ satCount, asteroidCount, filter, tleSource }) {
  const isDemo = tleSource === 'fallback';

  return (
    <div className="stats-bar">
      {filter !== 'asteroids' && (
        <div className="stat-chip satellites">
          <span className="stat-dot" />
          🛰️&nbsp;
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {satCount.toLocaleString()}
          </span>
          {isDemo && (
            <span className="source-badge demo" title="Curated satellite set — live data pending CelesTrak">
              DEMO
            </span>
          )}
          {tleSource === 'backend' && (
            <span className="source-badge live" title="Live TLE data from CelesTrak">
              LIVE
            </span>
          )}
        </div>
      )}
      {filter !== 'satellites' && (
        <div className="stat-chip asteroids">
          <span className="stat-dot" />
          ☄️&nbsp;
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {asteroidCount}
          </span>
          <span className="source-badge live" title="Live data from NASA NeoWs">LIVE</span>
        </div>
      )}
    </div>
  );
}
