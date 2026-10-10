# SENTRY — Urban Emergency Cascade Simulator

A self-contained, browser-only prototype for demonstrating how a fictional urban
emergency can cascade across flood risk, road access, power dependency, and
vulnerable locations. All locations, events, risk scores, and outcomes are
seeded synthetic simulation data. SENTRY is not an emergency service and does
not provide verified safety instructions.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To create a production build, run
`npm run build`.

## Simulation assumptions

- Rainfall is a user-controlled scenario input. It increases flood estimates
	for low-lying locations and connected roads using fixed sensitivity values.
- Threatened or manually closed roads increase access risk for locations that
	depend on them. A simulated substation outage adds risk to power-dependent
	locations.
- Priority estimates combine flood risk, access risk, vulnerability, and
	estimated exposure. They are deterministic demonstration values, not
	forecasts or operational recommendations.
- The pump intervention reduces modeled flood risk and protects one designated
	corridor. It does not override a manual road closure.
- Scenario state is held in memory and resets when the page is refreshed.