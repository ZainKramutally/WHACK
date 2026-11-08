// Powered flight: what a body must spend to stay up, what its muscles can give, and the height where the two meet.
// Pure functions; every coefficient comes from the world's life.inputs.flight (worlds/*.ts) with its why and sources.
//
//   Required power   P_req = ε · (m·g)^1.5 / sqrt(2·ρ·A)      actuator disc (Rankine–Froude), A = π/4·span²
//   Available power  P_av  = muscleFrac · m · specificPower · (m/massRef)^−powerExp · scope
//   scope            carbon: aerobic, ∝ O₂; silicon: a neutral constant (not aerobic, assumption)
//   Air thins        ρ(h) = ρ₀·e^(−h/H), H = R·T/(M·g)   so  P_req ∝ e^(h/2H)  and, on carbon, P_av ∝ pO₂ ∝ e^(−h/H)
//   Ceiling          P_av = P_req  →  h* = (2H/3)·ln(P_av₀/P_req₀) on carbon, 2H·ln(P_av₀/P_req₀) on silicon.
// A lighter-than-air body (gas bag) also rises until ρ(h) = ρ_body, h = H·ln(ρ₀/ρ_body); the ceiling is the higher of the two.

const R_GAS = 8.314462; // J/(mol·K), CODATA
const G0 = 9.80665; // m/s², standard gravity

export interface FlightParams {
  airScale: number; // develop()'s air-density scale (kg/m³ → unbuoyed carbon tissue = 1); copied from life.inputs.airDensity.scale
  molarMass: number; // kg/mol of the main gas; copied from life.inputs.airDensity.molarMass
  spanPerLength: number; // axial wing span in body lengths per unit of the plan's wingSpan
  powerFactor: number; // ε ≥ 1: profile and parasite power on top of the ideal induced power
  muscleFrac: number; // flight-muscle share of body mass
  specificPower: number; // W per kg of flight muscle at massRef and full aerobic scope
  massRef: number; // kg
  powerExp: number; // specific power falls as mass^−powerExp (wingbeat frequency falls with size)
  o2Ref: number; // % O₂ at which carbon's scope is 1 (Earth)
  siliconScope: number; // silicon's neutral power scope (not O₂-limited)
  costBase: number; // develop() mode cost of flight at zero power ratio (same units as walk and swim)
  costSlope: number; // develop() mode cost per unit of (P_req/P_av)²
  costInfeasible: number; // added mode cost when P_req ≥ P_av at the ground (cannot fly at all)
  forageLengths: number; // fliers forage this many body lengths above the ground
  cruiseFrac: number; // share of the ceiling used when travelling or fleeing
  altClock: number; // physical climb speed (m/s) × this = metres climbed per ecology second
  sinkRate: number; // metres descended per ecology second
  buoyRise: number; // metres per ecology second a gas-bag body rises by its own lightness
}

/** The config's flight coefficients plus the two air facts they share with life.inputs.airDensity. */
export function flightParamsFor(inputs: { flight: Omit<FlightParams, 'airScale' | 'molarMass'>; airDensity: { scale: number; molarMass: number } }): FlightParams {
  return { ...inputs.flight, airScale: inputs.airDensity.scale, molarMass: inputs.airDensity.molarMass };
}

export interface FlightEnv {
  gravity: number; // g
  temperatureC: number;
  oxygenPct: number;
  airKgM3: number; // real air density at the surface, kg/m³
  molarMass?: number; // kg/mol of the live air mix (default: FlightParams.molarMass, the main gas)
}

/** The slice of a BodyPlan flight reads. */
export interface FlightBody { mass: number; liftSpan: number; bodyDensity: number; chemistry: 'silicon' | 'carbon' }

/** The flight environment from a snapshot's stats: M comes back out of ρ = P·M/(R·T). */
export function flightEnvFromStats(st: Record<string, number>): FlightEnv {
  const T = st.temperature ?? 15;
  const rho = st.airDensity ?? 1.2;
  const P = st.pressure ?? 1;
  return {
    gravity: st.gravity ?? 1,
    temperatureC: T,
    oxygenPct: st.oxygen ?? 21,
    airKgM3: rho,
    molarMass: P > 0 ? (rho * R_GAS * (T + 273.15)) / (P * 1e5) : undefined,
  };
}

/** Aerobic scope: carbon's is proportional to O₂ (1 at Earth's); silicon's is a constant. */
export function aerobicScope(chemistry: 'silicon' | 'carbon', oxygenPct: number, p: FlightParams): number {
  if (chemistry === 'silicon') return p.siliconScope;
  return Math.max(0, oxygenPct) / p.o2Ref;
}

/** Power to stay aloft (W): induced power of an actuator disc of area π/4·span², times ε. */
export function requiredPower(mass: number, span: number, airKgM3: number, gravity: number, p: FlightParams): number {
  const weight = mass * G0 * gravity;
  const area = (Math.PI / 4) * span * span;
  return (p.powerFactor * weight ** 1.5) / Math.sqrt(2 * Math.max(1e-9, airKgM3) * Math.max(1e-9, area));
}

/** Power the flight muscles can sustain (W) at the given aerobic scope. */
export function availablePower(mass: number, scope: number, p: FlightParams): number {
  return p.muscleFrac * mass * p.specificPower * (mass / p.massRef) ** -p.powerExp * scope;
}

/** P_req / P_av at the ground; below 1 the body can fly. */
export function powerRatio(b: Pick<FlightBody, 'mass' | 'liftSpan' | 'chemistry'>, e: Pick<FlightEnv, 'gravity' | 'oxygenPct' | 'airKgM3'>, p: FlightParams): number {
  return requiredPower(b.mass, b.liftSpan, e.airKgM3, e.gravity, p) / Math.max(1e-12, availablePower(b.mass, aerobicScope(b.chemistry, e.oxygenPct, p), p));
}

/** Scale height H = R·T/(M·g), metres: lower gravity or warmer air gives a taller atmosphere. */
export function scaleHeight(e: Pick<FlightEnv, 'temperatureC' | 'gravity' | 'molarMass'>, p: Pick<FlightParams, 'molarMass'>): number {
  return (R_GAS * (e.temperatureC + 273.15)) / ((e.molarMass ?? p.molarMass) * G0 * e.gravity);
}

/** Highest altitude (m above the surface) the body can hold: powered flight or buoyancy, whichever is higher. 0 if it cannot leave the ground. */
export function flightCeiling(b: FlightBody, e: FlightEnv, p: FlightParams, tissueRhoC: number): number {
  const H = scaleHeight(e, p);
  const ratio = powerRatio(b, e, p);
  const k = b.chemistry === 'silicon' ? 2 : 2 / 3; // carbon: power falls with pO₂ as well as rising with thin air
  const powered = ratio < 1 ? k * H * Math.log(1 / ratio) : 0;
  const rhoBody = b.bodyDensity / tissueRhoC; // same scale as airKgM3·airScale
  const rhoAir = e.airKgM3 * p.airScale;
  const buoyant = rhoBody < rhoAir ? H * Math.log(rhoAir / rhoBody) : 0;
  return Math.max(powered, buoyant);
}

/** develop()'s powered-flight mode cost (dimensionless, same units as walk/swim): cheap at a small power ratio, steep beyond it. */
export function flightModeCost(ratio: number, p: FlightParams): number {
  return p.costBase + p.costSlope * ratio * ratio + (ratio >= 1 ? p.costInfeasible : 0);
}

/** Metres climbed per ecology second at altitude h: the excess power over weight (a climb rate in m/s), times the altitude clock. */
export function climbRate(b: Pick<FlightBody, 'mass' | 'liftSpan' | 'chemistry'>, e: FlightEnv, p: FlightParams, h: number): number {
  const H = scaleHeight(e, p);
  const rho = e.airKgM3 * Math.exp(-h / H);
  const o2 = b.chemistry === 'silicon' ? e.oxygenPct : e.oxygenPct * Math.exp(-h / H); // partial pressure falls with the air
  const req = requiredPower(b.mass, b.liftSpan, rho, e.gravity, p);
  const av = availablePower(b.mass, aerobicScope(b.chemistry, o2, p), p);
  return Math.max(0, ((av - req) / (b.mass * G0 * e.gravity)) * p.altClock);
}
