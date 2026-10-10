import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BatteryWarning,
  ChevronDown,
  CloudRain,
  Crosshair,
  Droplets,
  Hospital,
  House,
  Info,
  MapPin,
  PlugZap,
  RotateCcw,
  Shield,
  ShieldCheck,
  Siren,
  Zap,
} from 'lucide-react';

type RiskLevel = 'safe' | 'watch' | 'high';
type LocationKind = 'hospital' | 'shelter' | 'community' | 'school' | 'power';

type Road = {
  id: string;
  name: string;
  path: string;
  sensitivity: number;
  routeFor: string[];
};

type Location = {
  id: string;
  name: string;
  shortName: string;
  kind: LocationKind;
  x: number;
  y: number;
  lowland: number;
  vulnerability: number;
  exposure: number;
  roadId: string;
  powerDependent: boolean;
};

type SimEvent = { id: number; time: string; title: string; detail: string; tone: RiskLevel | 'info' };

const roads: Road[] = [
  { id: 'west', name: 'Ring Road West', path: 'M 55 237 L 145 207 L 250 213 L 350 210 L 510 244', sensitivity: 0.72, routeFor: ['hospital', 'community'] },
  { id: 'north', name: 'Vasant Marg', path: 'M 250 213 L 270 104 L 370 86 L 433 177 L 510 244', sensitivity: 0.88, routeFor: ['shelter'] },
  { id: 'south', name: 'Yamuna Link', path: 'M 145 207 L 190 312 L 330 305 L 510 244', sensitivity: 0.94, routeFor: ['shelter', 'school'] },
  { id: 'market', name: 'Market Connector', path: 'M 350 210 L 330 305', sensitivity: 0.58, routeFor: ['school'] },
];

const locations: Location[] = [
  { id: 'hospital', name: 'Safdar Civic Hospital', shortName: 'Civic Hospital', kind: 'hospital', x: 145, y: 207, lowland: 0.45, vulnerability: 58, exposure: 340, roadId: 'west', powerDependent: true },
  { id: 'substation', name: 'Ridge Power Substation', shortName: 'Power Substation', kind: 'power', x: 370, y: 86, lowland: 0.32, vulnerability: 18, exposure: 12, roadId: 'north', powerDependent: false },
  { id: 'shelter', name: 'Nayi Disha Shelter', shortName: 'Nayi Disha Shelter', kind: 'shelter', x: 510, y: 244, lowland: 0.63, vulnerability: 82, exposure: 210, roadId: 'north', powerDependent: true },
  { id: 'community', name: 'Yamuna Khadar Community', shortName: 'Khadar Community', kind: 'community', x: 190, y: 312, lowland: 1, vulnerability: 96, exposure: 860, roadId: 'west', powerDependent: true },
  { id: 'school', name: 'Milan Public School', shortName: 'Milan School', kind: 'school', x: 330, y: 305, lowland: 0.76, vulnerability: 64, exposure: 490, roadId: 'market', powerDependent: false },
];

const INITIAL_EVENTS: SimEvent[] = [
  { id: 1, time: '14:32', title: 'Baseline scenario active', detail: 'Calm conditions across the modeled district.', tone: 'info' },
  { id: 2, time: '14:31', title: 'Access network clear', detail: 'All four modeled road links are open.', tone: 'safe' },
];

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const formatTime = (offset: number) => {
  const total = 14 * 60 + 32 + offset;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

function getLevel(score: number): RiskLevel {
  if (score >= 62) return 'high';
  if (score >= 30) return 'watch';
  return 'safe';
}

function locationIcon(kind: LocationKind) {
  if (kind === 'hospital') return Hospital;
  if (kind === 'shelter' || kind === 'community') return House;
  if (kind === 'power') return PlugZap;
  return MapPin;
}

function App() {
  const [rainfall, setRainfall] = useState(0);
  const [closedRoads, setClosedRoads] = useState<string[]>([]);
  const [powerOutage, setPowerOutage] = useState(false);
  const [intervention, setIntervention] = useState(false);
  const [compare, setCompare] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('community');
  const [selectedRoad, setSelectedRoad] = useState('south');
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [eventTick, setEventTick] = useState(0);
  const [flash, setFlash] = useState(false);

  const pushEvent = (title: string, detail: string, tone: SimEvent['tone']) => {
    const next = eventTick + 1;
    setEventTick(next);
    setEvents((current) => [{ id: next + 2, time: formatTime(next), title, detail, tone }, ...current].slice(0, 5));
    setFlash(true);
    window.setTimeout(() => setFlash(false), 480);
  };

  const metrics = useMemo(() => {
    const roadScores = Object.fromEntries(roads.map((road) => [
      road.id,
      clamp(rainfall * road.sensitivity * (intervention ? 0.73 : 1)),
    ])) as Record<string, number>;

    const locationMetrics = locations.filter((location) => location.kind !== 'power').map((location) => {
      const flood = clamp(rainfall * location.lowland * (intervention ? 0.7 : 1));
      const road = roads.find((item) => item.id === location.roadId)!;
      const roadRisk = roadScores[road.id];
      const closed = closedRoads.includes(road.id);
      const access = clamp((closed ? 76 : roadRisk >= 62 ? 56 : roadRisk >= 30 ? 31 : 5) + (intervention && !closed && road.id === 'west' ? -18 : 0));
      const power = powerOutage && location.powerDependent ? 54 : 0;
      const risk = Math.max(flood, access, power);
      const score = clamp(flood * 0.34 + access * 0.29 + location.vulnerability * 0.2 + Math.min(100, location.exposure / 10) * 0.17 + (power ? 12 : 0));
      return { ...location, flood, access, power, risk, score, level: getLevel(risk), road, closed };
    }).sort((a, b) => b.score - a.score);

    const roadMetrics = roads.map((road) => {
      const risk = roadScores[road.id];
      const closed = closedRoads.includes(road.id);
      return { ...road, risk, closed, level: closed ? 'high' as const : getLevel(risk) };
    });

    return { roadMetrics, locationMetrics, roadScores };
  }, [rainfall, closedRoads, powerOutage, intervention]);

  const selected = metrics.locationMetrics.find((item) => item.id === selectedLocation);
  const scenarioName = powerOutage && rainfall > 0 ? 'Compound disruption' : powerOutage ? 'Grid outage' : rainfall >= 60 ? 'Cloudburst' : rainfall > 0 ? 'Rainfall scenario' : 'Calm baseline';
  const highRoadCount = metrics.roadMetrics.filter((road) => road.level !== 'safe').length;
  const accessCount = metrics.locationMetrics.filter((location) => location.access >= 30).length;

  const toggleRoad = (roadId: string) => {
    const wasClosed = closedRoads.includes(roadId);
    setSelectedRoad(roadId);
    setClosedRoads((current) => wasClosed ? current.filter((id) => id !== roadId) : [...current, roadId]);
    const name = roads.find((road) => road.id === roadId)?.name ?? 'Road link';
    pushEvent(wasClosed ? `${name} reopened` : `${name} closed`, wasClosed ? 'Modeled access restored on this link.' : 'Manual closure is now affecting connected access estimates.', wasClosed ? 'safe' : 'high');
  };

  const setRain = (value: number) => {
    setRainfall(value);
    const title = value >= 60 ? 'Heavy rainfall detected' : value >= 25 ? 'Rainfall intensity increased' : value > 0 ? 'Light rainfall scenario set' : 'Rainfall returned to baseline';
    const detail = value > 0 ? `Synthetic rainfall input adjusted to ${value} mm/h.` : 'Flood estimates returned to calm conditions.';
    pushEvent(title, detail, value >= 60 ? 'high' : value > 0 ? 'watch' : 'info');
  };

  const triggerCloudburst = () => {
    setRainfall(82);
    pushEvent('Cloudburst scenario triggered', 'Rainfall set to 82 mm/h; low-lying flood estimates are rising.', 'high');
  };

  const togglePower = () => {
    const next = !powerOutage;
    setPowerOutage(next);
    pushEvent(next ? 'Substation outage simulated' : 'Substation power restored', next ? 'Power-dependent locations receive an added risk factor.' : 'Power dependency risk removed from modeled locations.', next ? 'high' : 'safe');
  };

  const toggleIntervention = () => {
    const next = !intervention;
    setIntervention(next);
    pushEvent(next ? 'Pump and route protection deployed' : 'Intervention removed', next ? 'Flood estimates reduced in lowland zones; west corridor protected.' : 'Risk estimates returned to the unmitigated scenario.', next ? 'safe' : 'info');
  };

  const reset = () => {
    setRainfall(0);
    setClosedRoads([]);
    setPowerOutage(false);
    setIntervention(false);
    setCompare(false);
    setSelectedLocation('community');
    setSelectedRoad('south');
    setEvents(INITIAL_EVENTS);
    setEventTick(0);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 480);
  };

  const cascade = [
    { title: 'Cloudburst', sub: rainfall > 0 ? `${rainfall} mm/h simulated` : 'Initial event', active: rainfall > 0, Icon: CloudRain },
    { title: 'Flood risk', sub: rainfall > 0 ? `Lowland estimate ${Math.max(...metrics.locationMetrics.map((item) => item.flood))}%` : 'No elevated estimate', active: rainfall >= 25, Icon: Droplets },
    { title: 'Road access', sub: closedRoads.length > 0 ? `${closedRoads.length} manual closure${closedRoads.length === 1 ? '' : 's'}` : highRoadCount > 0 ? 'Connected links threatened' : 'Modeled links clear', active: closedRoads.length > 0 || highRoadCount > 0, Icon: Activity },
    { title: 'Community impact', sub: accessCount > 0 ? `${accessCount} locations with access risk` : 'Access estimates steady', active: accessCount > 0 || powerOutage, Icon: House },
  ];

  return (
    <main className={`app-shell ${flash ? 'has-update' : ''}`}>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="SENTRY dashboard home">
          <span className="brand-mark"><Crosshair size={22} strokeWidth={1.8} /></span>
          <span><strong>SENTRY</strong><small>URBAN CASCADE SIMULATOR</small></span>
        </a>
        <div className="topbar-right">
          <span className="simulation-badge"><span className="pulse-dot" /> SIMULATION MODE</span>
          <span className="topbar-divider" />
          <span className="scenario-select"><span className={`status-dot ${rainfall > 0 || powerOutage ? 'dot-watch' : ''}`} />{scenarioName}<ChevronDown size={14} /></span>
          <button className="icon-button reset-button" onClick={reset} aria-label="Reset simulation" title="Reset simulation"><RotateCcw size={16} /><span>Reset</span></button>
        </div>
      </header>

      <div className="dashboard" id="top">
        <section className="intro-row">
          <div>
            <div className="eyebrow"><span className="eyebrow-rule" /> DISTRICT OPERATIONS / DEMO 04</div>
            <h1>Urban response <span>simulator</span></h1>
            <p className="intro-copy">Explore how a single disruption can ripple across a city district.</p>
          </div>
          <div className="simulation-clock"><span className="clock-indicator" /> SIMULATED TIME <strong>{formatTime(eventTick)}</strong></div>
        </section>

        <section className="control-strip" aria-label="Scenario controls">
          <div className="control-primary">
            <button className="action-button cloudburst-button" onClick={triggerCloudburst}><CloudRain size={16} /> Trigger cloudburst</button>
            <div className="rain-control">
              <label htmlFor="rainfall-slider"><span><Droplets size={14} /> Rainfall intensity</span><strong>{rainfall}<small> mm/h</small></strong></label>
              <input id="rainfall-slider" type="range" min="0" max="100" step="1" value={rainfall} onChange={(event) => setRain(Number(event.target.value))} style={{ '--range-progress': `${rainfall}%` } as React.CSSProperties} />
              <div className="range-labels"><span>Calm</span><span>Extreme</span></div>
            </div>
          </div>
          <div className="control-actions">
            <button className={`toggle-control ${powerOutage ? 'is-active' : ''}`} onClick={togglePower} aria-pressed={powerOutage}>
              <span className="toggle-icon"><Zap size={15} /></span><span><strong>Power outage</strong><small>{powerOutage ? 'Substation offline' : 'Substation online'}</small></span><span className="switch" />
            </button>
            <button className={`toggle-control intervention-control ${intervention ? 'is-active' : ''}`} onClick={toggleIntervention} aria-pressed={intervention}>
              <span className="toggle-icon"><ShieldCheck size={15} /></span><span><strong>{intervention ? 'Intervention active' : 'Deploy intervention'}</strong><small>{intervention ? 'Pump + route protection' : 'Pump + route protection'}</small></span><span className="switch" />
            </button>
            <button className={`compare-button ${compare ? 'is-active' : ''}`} onClick={() => setCompare((value) => !value)} aria-pressed={compare}><Activity size={15} /> Compare baseline</button>
          </div>
        </section>

        <section className="metrics-strip" aria-label="Scenario overview">
          <div className="metric-cell"><span className="metric-icon rain-icon"><Droplets size={16} /></span><span className="metric-label">RAINFALL</span><strong>{rainfall}<small> mm/h</small></strong><span className="metric-note">Simulated input</span></div>
          <div className="metric-cell"><span className="metric-icon road-icon"><Activity size={16} /></span><span className="metric-label">ROAD LINKS AT RISK</span><strong>{highRoadCount}<small> / {roads.length}</small></strong><span className="metric-note">{closedRoads.length} manually closed</span></div>
          <div className="metric-cell"><span className="metric-icon access-icon"><Siren size={16} /></span><span className="metric-label">ACCESS WATCH</span><strong>{accessCount}<small> locations</small></strong><span className="metric-note">Estimated route impact</span></div>
          <div className="metric-cell"><span className="metric-icon power-icon"><BatteryWarning size={16} /></span><span className="metric-label">GRID STATUS</span><strong className="metric-status">{powerOutage ? 'Outage' : 'Stable'}</strong><span className="metric-note">{powerOutage ? 'Dependency risk active' : 'Substation online'}</span></div>
          <div className="estimate-note"><Info size={14} /><span>All values are simulated estimates</span></div>
        </section>

        <div className="main-grid">
          <section className="panel map-panel" aria-labelledby="map-title">
            <div className="panel-heading">
              <div><div className="section-kicker">LIVE SCENARIO VIEW</div><h2 id="map-title">Khadar district <span className="district-code">D-04</span></h2></div>
              <button className="map-locate" onClick={() => setSelectedLocation('community')} aria-label="Center map on highest vulnerability location" title="Focus vulnerable community"><Crosshair size={16} /></button>
            </div>
            <div className="map-frame">
              <div className="map-water-label">YAMUNA FLOODPLAIN</div>
              <span className="north-arrow">N<i>↑</i></span>
              <svg className="district-map" viewBox="0 0 600 380" role="img" aria-label="Interactive schematic map of fictional Khadar district. Select a road to close or reopen it, or select a marker for location details.">
                <defs>
                  <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M 34 0 L 0 0 0 34" fill="none" stroke="#22313a" strokeWidth="0.6" opacity=".58" /></pattern>
                  <pattern id="water" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M-2 11 Q 3 7 8 11 T18 11 T28 11" fill="none" stroke="#276579" strokeWidth="1" opacity=".52" /></pattern>
                </defs>
                <rect width="600" height="380" fill="url(#grid)" />
                <path className="floodplain" d="M 0 284 C 74 257 110 287 151 272 C 198 255 207 331 269 345 C 332 360 387 332 425 356 L 425 380 L 0 380 Z" fill="url(#water)" />
                <path d="M 0 283 C 74 256 110 286 151 271 C 198 254 207 330 269 344 C 332 359 387 331 425 355" className="river-edge" />
                <path d="M 48 145 L 107 111 L 164 131 L 205 96 M 418 105 L 466 121 L 523 133 M 56 276 L 103 294 M 391 279 L 443 293 L 485 321" className="minor-street" />
                <text x="83" y="128" className="map-neighborhood">VASANT VIHAR</text>
                <text x="434" y="151" className="map-neighborhood">CIVIC ENCLAVE</text>
                <text x="365" y="347" className="map-neighborhood">KHADAR BASTI</text>
                <text x="54" y="328" className="water-text">YAMUNA FLOODPLAIN</text>
                {metrics.roadMetrics.map((road) => <g key={road.id} className={`road-group road-${road.level} ${road.closed ? 'road-closed' : ''} ${selectedRoad === road.id ? 'road-selected' : ''}`} onClick={() => toggleRoad(road.id)} role="button" tabIndex={0} aria-label={`${road.name}, ${road.closed ? 'closed' : `${road.level} risk`}. Select to ${road.closed ? 'reopen' : 'close'} road.`} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleRoad(road.id); } }}>
                  <path d={road.path} className="road-halo" />
                  <path d={road.path} className="road-line" />
                  <path d={road.path} className="road-hitbox" />
                  <text className="road-label" x={road.id === 'north' ? 278 : road.id === 'south' ? 218 : road.id === 'market' ? 346 : 274} y={road.id === 'north' ? 130 : road.id === 'south' ? 274 : road.id === 'market' ? 270 : 196}>{road.name}</text>
                  {road.closed && <g className="closure-marker" transform={road.id === 'south' ? 'translate(252 307)' : road.id === 'north' ? 'translate(349 152)' : road.id === 'market' ? 'translate(341 256)' : 'translate(280 210)'}><circle r="13" /><path d="M-5 -5 L5 5 M5 -5 L-5 5" /></g>}
                </g>)}
                {locations.map((location) => {
                  const metricsForLocation = metrics.locationMetrics.find((item) => item.id === location.id);
                  const level = location.kind === 'power' ? (powerOutage ? 'high' : 'safe') : metricsForLocation?.level ?? 'safe';
                  const Icon = locationIcon(location.kind);
                  const isSelected = selectedLocation === location.id;
                  const labelAnchor = location.x > 440 ? 'end' : 'start';
                  const labelX = location.x > 440 ? location.x - 21 : location.x + 21;
                  return <g key={location.id} className={`location-marker marker-${level} ${isSelected ? 'marker-selected' : ''}`} transform={`translate(${location.x} ${location.y})`} onClick={() => setSelectedLocation(location.id)} role="button" tabIndex={0} aria-label={`${location.name}, ${level} risk`} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedLocation(location.id); } }}>
                    <circle className="marker-halo" r="18" /><circle className="marker-core" r="13" />
                    <foreignObject x="-8" y="-8" width="16" height="16"><Icon size={16} strokeWidth={2} className="marker-icon" /></foreignObject>
                    <text className="location-label" x={labelX - location.x} y={location.id === 'hospital' ? 27 : location.id === 'community' ? 27 : -19} textAnchor={labelAnchor}>{location.shortName}</text>
                    {location.kind === 'power' && powerOutage && <circle className="outage-ping" r="20" />}
                  </g>;
                })}
              </svg>
              <div className="map-scale"><span /> 500 m</div>
              <div className="map-callout"><span className="callout-pin"><MapPin size={13} /></span><span><strong>{selected?.shortName ?? 'Ridge Power Substation'}</strong><small>{selected ? `${selected.level.toUpperCase()} RISK · ${selected.score} priority estimate` : 'SUBSTATION · GRID NODE'}</small></span></div>
            </div>
            <div className="map-footer">
              <div className="legend"><span className="legend-title">RISK KEY</span><span><i className="legend-swatch safe-swatch" />Low</span><span><i className="legend-swatch watch-swatch" />Watch</span><span><i className="legend-swatch high-swatch" />High</span><span><i className="legend-road" />Road</span></div>
              <span className="map-help">Select a road to toggle closure</span>
            </div>
          </section>

          <aside className="side-column">
            <section className="panel priorities-panel" aria-labelledby="priorities-title">
              <div className="panel-heading compact-heading"><div><div className="section-kicker">ATTENTION QUEUE</div><h2 id="priorities-title">Priority locations</h2></div><span className="rank-count">{metrics.locationMetrics.length} SITES</span></div>
              <p className="panel-description">Ranked by simulated exposure, vulnerability, flood and access risk.</p>
              <div className="priority-list">
                {metrics.locationMetrics.map((location, index) => {
                  const Icon = locationIcon(location.kind);
                  const baseline = clamp(5 * 0.29 + location.vulnerability * 0.2 + Math.min(100, location.exposure / 10) * 0.17);
                  const delta = location.score - baseline;
                  return <button className={`priority-row ${selectedLocation === location.id ? 'is-selected' : ''}`} key={location.id} onClick={() => setSelectedLocation(location.id)}>
                    <span className={`rank-index ${index === 0 ? 'rank-top' : ''}`}>{String(index + 1).padStart(2, '0')}</span>
                    <span className={`priority-icon level-${location.level}`}><Icon size={16} /></span>
                    <span className="priority-copy"><strong>{location.shortName}</strong><small>{location.closed ? 'Route closed' : location.access >= 30 ? 'Access threatened' : location.flood >= 30 ? 'Flood estimate rising' : 'Monitoring'}</small></span>
                    <span className="priority-score"><strong>{location.score}</strong><small>{compare ? `${delta >= 0 ? '+' : ''}${delta} vs base` : 'EST.'}</small></span>
                  </button>;
                })}
              </div>
              {selected && <div className={`reason-box reason-${selected.level}`}><div className="reason-heading"><Info size={14} /> WHY THIS RANKING</div><p>{selected.name} ranks {metrics.locationMetrics.findIndex((item) => item.id === selected.id) + 1} of {metrics.locationMetrics.length} because {selected.flood >= 30 ? 'lowland flood risk is elevated' : 'modeled flood risk remains low'}{selected.access >= 30 ? ` and ${selected.road.name} ${selected.closed ? 'is closed' : 'is threatened'}` : ''}{selected.power > 0 ? ' while a power dependency is disrupted' : ''}. Vulnerability ({selected.vulnerability}/100) and estimated exposure ({selected.exposure}) also contribute.</p></div>}
              <div className="score-caption"><span>SIMULATED PRIORITY ESTIMATE</span><Info size={13} /></div>
            </section>

            <section className="panel feed-panel" aria-labelledby="feed-title">
              <div className="panel-heading compact-heading"><div><div className="section-kicker">SCENARIO LOG</div><h2 id="feed-title">Incident feed</h2></div><span className="live-label"><i /> LIVE</span></div>
              <div className="feed-list" aria-live="polite">
                {events.map((event) => <article className="feed-event" key={event.id}><span className={`feed-event-mark tone-${event.tone}`} /> <time>{event.time}</time><div><strong>{event.title}</strong><p>{event.detail}</p></div></article>)}
              </div>
            </section>
          </aside>
        </div>

        <section className="lower-grid">
          <section className="panel cascade-panel" aria-labelledby="cascade-title">
            <div className="panel-heading cascade-heading"><div><div className="section-kicker">CAUSE → CONSEQUENCE</div><h2 id="cascade-title">Emergency cascade</h2></div><span className="cascade-note"><span className="cascade-active-dot" /> Triggered links update with the scenario</span></div>
            <div className="cascade-track">
              {cascade.map(({ title, sub, active, Icon }, index) => <div className={`cascade-step ${active ? 'step-active' : ''}`} key={title}>
                <div className="cascade-node"><Icon size={17} /><span className="step-number">0{index + 1}</span></div>
                <div className="cascade-copy"><strong>{title}</strong><small>{sub}</small></div>
                {index < cascade.length - 1 && <div className={`cascade-connector ${active && cascade[index + 1].active ? 'connector-active' : ''}`}><ArrowRight size={15} /></div>}
              </div>)}
            </div>
            <div className="cascade-footnote"><Info size={13} /> A link activates when its modeled threshold is crossed; manual closures and outages appear as separate triggers.</div>
          </section>

          <section className="panel road-controls" aria-labelledby="roads-title">
            <div className="panel-heading compact-heading"><div><div className="section-kicker">NETWORK CONTROLS</div><h2 id="roads-title">Road access</h2></div><span className="rank-count">{roads.length} LINKS</span></div>
            <p className="panel-description">Choose a link to close or restore it in the scenario.</p>
            <div className="road-control-list">{metrics.roadMetrics.map((road) => <button key={road.id} className={`road-control-row ${selectedRoad === road.id ? 'is-selected' : ''}`} onClick={() => toggleRoad(road.id)}><span className={`road-status status-${road.level}`} /><span className="road-control-name"><strong>{road.name}</strong><small>{road.closed ? 'Manually closed' : `${road.risk}% simulated risk`}</small></span><span className={`road-toggle ${road.closed ? 'closed-toggle' : ''}`}>{road.closed ? 'Reopen' : 'Close'}<ArrowDownRight size={13} /></span></button>)}</div>
          </section>
        </section>

        <footer className="disclaimer"><Shield size={15} /><span><strong>DEMONSTRATION ONLY</strong> SENTRY uses fictional locations and deterministic synthetic estimates. Not an emergency service, live data source, forecast, or verified safety guidance.</span><span className="footer-version">SENTRY / PROTOTYPE 0.1</span></footer>
      </div>
    </main>
  );
}

export default App;