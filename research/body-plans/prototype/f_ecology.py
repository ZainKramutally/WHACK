"""Headless toy of design F's genome -> develop() -> ecology/selection loop.

Measures time-to-trait (legs, horns, plates, eyes, buoyancy, long bodies, hunters)
from a worm founder. A toy, not F itself: see notes/04-time-to-trait.md.

Usage:
  python3 f_ecology.py --one --preset earth --cap 1000 --T 600 --seed 0
  python3 f_ecology.py --sweep --T 2400 --procs 12 --out ../data/time-to-trait.json
"""
import argparse, json, math, time, itertools, os, sys
import numpy as np

# ---------------------------------------------------------------- presets
# Dials in [0,1]. Recipe = (c, si, o). WORLD_ATLAS §5.3 presets.
SEA = {  # atk_si = silicon dissolution (R5), rho_base for air density (F §4)
    "water":   dict(atk_si=0.9, rho=0.35),
    "acid":    dict(atk_si=0.3, rho=0.45),
    "ammonia": dict(atk_si=0.5, rho=0.60),
    "methane": dict(atk_si=0.1, rho=0.90),
}
PRESETS = {
    "earth":    dict(recipe=(0.70, 0.15, 0.15), sea="water",   heat=0.50, light=0.85, hunger=0.20),
    "silicon":  dict(recipe=(0.10, 0.60, 0.30), sea="acid",    heat=0.70, light=0.30, hunger=0.40),
    "dusk":     dict(recipe=(0.15, 0.70, 0.15), sea="ammonia", heat=0.35, light=0.30, hunger=0.90),
    "frozen":   dict(recipe=(0.10, 0.55, 0.35), sea="methane", heat=0.15, light=0.30, hunger=0.20),
    "rhino":    dict(recipe=(0.15, 0.65, 0.20), sea="water",   heat=0.50, light=0.55, hunger=0.55),
}

# ---------------------------------------------------------------- templates (guided mode)
# Body-plan attractors from DESIGN.md §4 + WORLD_ATLAS fauna pins. genes: {index: target};
# seg = target segment count; aff(env, rho_air) -> affinity in [0,1] (WORLD_ATLAS/F §6 rules).
def _clip01(v):
    return max(0.0, min(1.0, v))


TEMPLATES = [
    dict(name="drifter_jelly", seg=4, hunter=False, drift=True,     # fauna-03 jellybots
         genes={6: .95, 7: .9, 25: .95, 9: 0.0, 10: .3, 12: .6, 24: .15, 26: .8, 1: .25},
         aff=lambda e, r, c, si, o: _clip01(0.2 + 0.8 * min(1, r / 0.6)) * (0.5 + 0.5 * (1 - e["light"])) * (0.5 + si + o) / 1.5),
    dict(name="swimmer_eel", seg=10, hunter=False, drift=False,     # fauna-08 confetti eels
         genes={9: .6, 10: .3, 24: .15, 27: .85, 30: .9, 5: .9},
         aff=lambda e, r, c, si, o: (1.0 if e["sea"] in ("water", "acid") else 0.4) * (0.4 + c) * (1 - abs(e["hunger"] - 0.5))),
    dict(name="spinner", seg=6, hunter=False, drift=False,          # DESIGN §4 spinners / crystal wheels
         genes={6: .85, 9: 0.0, 10: 1.0, 11: 0.0, 12: .2, 24: .3, 14: .4},
         aff=lambda e, r, c, si, o: 0.5 * si),
    dict(name="plated_hopper", seg=5, hunter=False, drift=False,    # fauna-06
         genes={9: .6, 10: .99, 11: .99, 12: .9, 14: .75, 19: .8, 20: .1, 24: .15},
         aff=lambda e, r, c, si, o: (0.3 + 0.7 * (1 - e["light"])) * (0.3 + 0.7 * e["hunger"]) * (0.5 + c)),
    dict(name="frilled_serpent", seg=14, hunter=True, drift=False,  # fauna-05 / eco-09 hunter
         genes={9: .2, 10: .6, 11: .5, 12: .15, 24: .85, 23: .85, 16: .9, 17: .7, 21: .2},
         aff=lambda e, r, c, si, o: e["hunger"] ** 1.5 * (1.0 if e["sea"] == "water" else 0.7) + 0.05),
    dict(name="builder", seg=5, hunter=False, drift=False,          # DESIGN §4 builders, eco-14 beetles
         genes={14: .7, 6: .8, 24: .1, 1: .3, 9: .2, 10: .9, 11: .5},
         aff=lambda e, r, c, si, o: _clip01(si * o / 0.15) * (1.0 if e["sea"] == "acid" else 0.6)),
    dict(name="strider", seg=4, hunter=False, drift=False,          # fauna-01 / fauna-07
         genes={7: .95, 9: 0.0, 10: .99, 11: .4, 12: .95, 1: .6, 19: .6, 20: .9, 31: .7, 24: .3},
         aff=lambda e, r, c, si, o: si * (0.4 + 0.6 * (1 - e["heat"])) * (1 - 0.6 * e["hunger"])),
    dict(name="rhino_lizard", seg=7, hunter=False, drift=False,     # fauna-02
         genes={9: .28, 10: .75, 11: .4, 12: .35, 14: .8, 21: .85, 19: .5, 1: .45, 24: .35},
         aff=lambda e, r, c, si, o: si * (1.0 if e["sea"] == "water" else 0.6) * (1 - abs(e["hunger"] - 0.55))),
    dict(name="sky_whale", seg=8, hunter=False, drift=True,         # fauna-09
         genes={1: .85, 25: .95, 9: .6, 10: .3, 18: .9, 19: .2, 24: .1},
         aff=lambda e, r, c, si, o: _clip01(r / 0.9) ** 2 * (0.3 + c) * (1 - e["heat"]) * (1 - e["hunger"])),
]


def template_affinity(env):
    rho = SEA[env["sea"]]["rho"] * (1.3 - env["heat"])
    c, si, o = env["recipe"]
    a = np.array([max(0.0, T["aff"](env, rho, c, si, o)) for T in TEMPLATES])
    return a / max(a.max(), 1e-9)   # best-fitting template = 1


# ---------------------------------------------------------------- coefficients
# Every number used by the ledger. Per-second flows are per unit mass at M=1 and
# scale by M^-0.25 (Kleiber), so small bodies live fast.
C = dict(
    dt=0.25,            # s per tick in the toy (F uses 0.05; rates are per second, see --dt check)
    world=64.0,         # m, torus side (toy; F dish radius 150 m, but founders 0.15 m need a smaller arena)
    grid=32,            # food/encounter grid (F uses 64^2 for canopy; 32^2 = 2 m cells)
    liquid_frac=0.35,   # central disc of liquid cells (swim allowed)
    b0=0.020,           # basal metabolism per mass at M=1
    i0=0.160,           # max plant intake per mass at M=1, times (1-t)^1.5
    k_loco=0.012,       # locomotion cost per mass at M=1, times per-mode cost factor
    crawl=3.0,          # crawl cost factor (F: x6 of a nominal walker at 0.5)
    swim=1.2,           # swim cost factor before the undulation discount
    float_h=0.5,        # horizontal cost factor aloft
    k_hover=0.06,       # hover cost per mass per unit (rho_body - rho_air)
    k_eye=0.2,          # eye cost 0.2*A^2 (F ledger)
    k_dis=0.05,         # dissolution per mass: k_dis*atk_si*si*(1-cover)
    k_heat=0.4,         # heat stress 0.4*max(0,heat-0.5)*S (per mass, S capped at 3)
    plate_mass=0.4, horn_mass=0.3, limb_mass=0.12,
    plate_build=0.25,   # birth cost * cover/(0.2+si) in units of M
    food_r=0.40,        # producer regrowth per s at light=1: r(0.2+light)(K-F)(0.3+0.7F/K)
    food_K=0.020,       # producer biomass cap per cell at cap=1000 (scaled by cap/1000); sized so food binds near cap
    beta_enc=0.6,       # encounter rate scale for hunting attempts
    meat_eff=2.0,       # [game] meat energy density: gain = meat_eff*t*(0.3+0.6H)*(E_prey + 0.5 M_prey)
    hunger_scarcity=0.6,  # [game] Hunger = Spark scarcity (DESIGN §4): plant intake x(1 - 0.6 H)
    counter=0.25,       # counter-damage to a failed attacker per unit prey hornRel (x M_h)
    float_graze=0.5,    # floaters graze at half rate (aerial plankton / canopy tops)
    mut_p=0.3, mut_sigma=0.05, dup_p=0.03, del_p=0.01, hox_p=0.05,
    no_cannibal=True,
    tpl_switch=0.01,    # guided: per-birth chance a lineage re-picks its template (affinity-weighted)
)
NG = 32
(SEGN, SIZE, R0, R1, R2, ELONG, SYM, AXIS, HEADLEN, LSTART, LEND, LPER, LLEN, LJOINT,
 PCOV, PSIZE, DMIX, DDENS, TAIL, EYEB, EYEC, HORN, HORNC, GAPE, DIET, BUOY, GLOW, SOC,
 BOLD, RK, PATT, HEADW) = range(32)


def rate_of(heat):  # log-compressed rate(heat); 0.44 at heat 0.1, 1.0 at 0.5
    return 0.3 + 1.4 * heat


def develop(G, segN, comp, env):
    """Vectorised F §3.3 develop(): genome rows -> traits used by the ledger."""
    heat, light = env["heat"], env["light"]
    rho_air = SEA[env["sea"]]["rho"] * (1.3 - heat)
    c, si, o = comp[:, 0], comp[:, 1], comp[:, 2]
    tsr = 1.6 + (0.65 - 1.6) * heat
    buoy = G[:, BUOY]
    S = 0.15 * 2 ** (6 * G[:, SIZE]) * tsr * (1 + 0.6 * rho_air * buoy)
    ls = np.floor(segN * G[:, LSTART]).astype(int)
    le = np.floor(segN * G[:, LEND]).astype(int)
    per = 1 + np.floor(2.99 * G[:, LPER]).astype(int)
    span = np.maximum(0, le - ls)
    npairs = np.minimum(4, np.ceil(span / per)).astype(int)
    lenrel = 0.3 + 1.7 * G[:, LLEN]
    cover = G[:, PCOV]
    plates = np.round(cover * segN).astype(int)
    hornrel = G[:, HORN] * 0.6
    A = G[:, EYEB] * (1.5 - light)
    eyecount = np.where(si > 0.5, np.where(G[:, EYEC] < 0.33, 3, np.where(G[:, EYEC] < 0.66, 4, 6)),
                        np.where(G[:, EYEC] < 0.25, 1, 2))
    t = G[:, DIET]
    limbm = C["limb_mass"] * npairs * lenrel ** 2 * (1 - 0.5 * si)
    M = S ** 3 * (segN / 6.0) * (1 + C["plate_mass"] * cover + C["horn_mass"] * hornrel + limbm)
    rho_body = 1.0 - 0.75 * buoy
    vision = 6 * A * S ** 0.3 * (0.25 + light) * (1 + 0.3 * G[:, DDENS] * si)  # rods add touch sense
    gape_len = S * (0.5 + 1.5 * G[:, GAPE])
    return dict(S=S, M=M, npairs=npairs, lenrel=lenrel, cover=cover, plates=plates, hornrel=hornrel,
                A=A, eyecount=eyecount, t=t, rho_body=rho_body, rho_air=rho_air, vision=vision,
                gape=gape_len, si=si, c=c, o=o, segN=segN, buoy=buoy)


def traits_flags(D):
    """Measured traits (task definitions)."""
    return {
        "legs2": D["npairs"] >= 2,
        "horns": D["hornrel"] >= 0.3,                      # horn >= 0.3 body length (g21 >= 0.5)
        "plates3": (D["plates"] >= 3) & (D["cover"] >= 0.35),
        "eyes": ((D["eyecount"] >= 4) & (D["A"] >= 0.3)) | (D["A"] >= 0.6),
        "buoyant": D["mode"] == 3,
        "buoyant_giant": (D["mode"] == 3) & (D["S"] >= 1.5),
        "long8": D["segN"] >= 8,
        "hunter": D["t"] >= 0.6,
    }


class Sim:
    def __init__(self, preset, cap=1000, mut_mult=1.0, dup=True, seed=0, cheats=False,
                 founder_var=0.03, dt=None, guided=False, pull=0.1):
        self.env = dict(PRESETS[preset]); self.preset = preset
        self.cap, self.mut_mult, self.dup, self.cheats = cap, mut_mult, dup, cheats
        self.rng = np.random.default_rng(seed)
        self.dt = dt or C["dt"]
        g = C["grid"]; self.g = g; self.cs = C["world"] / g
        xs = (np.arange(g) + 0.5) * self.cs - C["world"] / 2
        X, Y = np.meshgrid(xs, xs, indexing="ij")
        self.liquid = ((X ** 2 + Y ** 2) < C["liquid_frac"] * C["world"] ** 2 / math.pi).ravel()
        self.K = C["food_K"] * cap / 1000.0 * 1.0
        self.food = np.full(g * g, self.K)
        rng = self.rng
        # founder: one copier sequence (length 4-6) -> 24 near-identical worms (F §3.2)
        L = rng.integers(4, 7)
        base = rng.uniform(0.3, 0.7, NG)
        base[SEGN] = (L - 3) / 13; base[SIZE] = 0.0; base[LSTART] = 0.6; base[LEND] = 0.3
        base[DIET] = 0.1; base[EYEB] = 0.15; base[BUOY] = 0.2; base[PCOV] = 0.05; base[HORN] = 0.02
        base[RK] = 0.6; base[GAPE] = 0.3; base[DDENS] = 0.1
        self.guided, self.pull = guided, pull
        n0 = cap // 2 if guided else 24   # guided: "tons of tiny capsule worms" from the start
        self.G = np.clip(base + rng.normal(0, founder_var, (n0, NG)), 0, 1)
        self.base = base; self.L0 = int(L)
        self.aff = template_affinity(self.env)
        p = self.aff ** 2 / (self.aff ** 2).sum()
        self.tpl = rng.choice(len(TEMPLATES), n0, p=p) if guided else np.full(n0, -1)
        self.state = np.zeros(n0, int); self.timer = np.zeros(n0)
        self.segN = np.full(n0, int(L))
        rec = np.array(self.env["recipe"])
        self.comp = np.tile(rec, (n0, 1))
        spread = C["world"] / 2 if guided else 10
        self.x = rng.uniform(-spread, spread, n0); self.y = rng.uniform(-spread, spread, n0)
        self.age = np.zeros(n0); self.depth = np.zeros(n0, int)
        self._derive_all()
        self.E = 0.8 * self.D["M"]
        self.t = 0.0; self.kills = 0; self.births = 0
        self.midwife_until = -1; self.meat_fired = False

    def _derive_all(self):
        self.D = develop(self.G, self.segN, self.comp, self.env)
        self.D["mode"] = np.zeros(len(self.G), int)

    def _mutate(self, G, segN, parent_comp, tpl=None):
        rng = self.rng; n = len(G)
        if self.guided and tpl is not None:
            # lineage branching: rare switch to another template, weighted by affinity
            sw = rng.random(n) < C["tpl_switch"]
            if sw.any():
                p = self.aff ** 2 / (self.aff ** 2).sum()
                tpl = tpl.copy(); tpl[sw] = rng.choice(len(TEMPLATES), int(sw.sum()), p=p)
            # developmental pull toward the lineage's template, scaled by its chemistry affinity
            G = G.copy(); segN = segN.copy()
            for k, T in enumerate(TEMPLATES):
                m = tpl == k
                if not m.any():
                    continue
                kk = self.pull * self.aff[k]
                idx = np.array(list(T["genes"].keys())); tgt = np.array(list(T["genes"].values()))
                G[np.ix_(m, idx)] += kk * (tgt - G[np.ix_(m, idx)])
                step = np.sign(T["seg"] - segN[m]) * (rng.random(m.sum()) < 2 * kk)
                segN[m] += step.astype(int)
                G[m, SEGN] = np.clip((segN[m] - 3) / 13, 0, 1)
            self._tpl_out = tpl
        sig = C["mut_sigma"] * self.mut_mult
        m = rng.random((n, NG)) < C["mut_p"]
        G0 = G
        G = np.clip(G + m * rng.normal(0, sig, (n, NG)), 0, 1)
        segN = segN.copy()
        if self.dup:
            segN += (rng.random(n) < C["dup_p"]).astype(int) - (rng.random(n) < C["del_p"]).astype(int)
        hox_p = C["hox_p"] * (5 if self.t < self.midwife_until else 1)
        h = rng.random(n) < hox_p
        which = rng.random(n) < 0.5; sgn = np.where(rng.random(n) < 0.5, -1.0, 1.0)
        step = sgn / np.maximum(segN, 3)
        G[h & which, LSTART] = np.clip(G[h & which, LSTART] + step[h & which], 0, 1)
        G[h & ~which, LEND] = np.clip(G[h & ~which, LEND] + step[h & ~which], 0, 1)
        # g0 point mutations also move segN (F: segN = 3 + round(13 g0)); duplication adds on top
        segN += np.round(13 * G[:, SEGN]).astype(int) - np.round(13 * G0[:, SEGN]).astype(int)
        segN = np.clip(segN, 3, 16)
        rec = np.array(self.env["recipe"])
        comp = 0.65 * parent_comp + 0.35 * rec + rng.normal(0, 0.03, parent_comp.shape)
        comp = np.clip(comp, 0.001, None); comp /= comp.sum(1, keepdims=True)
        return G, segN, comp

    def step(self):
        rng, D, dt, env = self.rng, self.D, self.dt, self.env
        n = len(self.G)
        if n == 0:
            return
        H, light, heat = env["hunger"], env["light"], env["heat"]
        rate = rate_of(heat)
        g, cs, W = self.g, self.cs, C["world"]
        ix = np.floor((self.x + W / 2) / cs).astype(int) % g
        iy = np.floor((self.y + W / 2) / cs).astype(int) % g
        cell = ix * g + iy
        M = D["M"]; kl = M ** -0.25  # Kleiber per-mass multiplier
        inliq = self.liquid[cell]
        # --- locomotion mode: cheapest of crawl/walk, swim (liquid), float
        walk = np.where(D["npairs"] > 0, 1.0 / (np.sqrt(2 * D["npairs"]) * D["lenrel"] + 1e-9), C["crawl"])
        walk = np.minimum(walk, C["crawl"])
        swim = np.where(inliq, C["swim"] / (1 + 0.6 * D["c"] * np.minimum(D["segN"], 12) / 12), 1e9)
        hover = C["k_hover"] * np.maximum(0, D["rho_body"] - D["rho_air"]) / C["k_loco"]
        flt = C["float_h"] + hover
        costs = np.stack([walk, swim, np.full(n, 1e9), flt], 1)  # mode 2 = sessile (unused)
        mode = np.argmin(costs, 1); D["mode"] = mode
        loco = costs[np.arange(n), mode]
        # --- per-template finite state machine (guided mode only); baseline = F steering, all x1
        move_m = np.ones(n); loco_m = np.ones(n); hunt_m = np.ones(n); vuln_m = np.ones(n)
        if self.guided:
            e = self.E / M
            ishunt = D["t"] >= 0.5
            hcell = np.bincount(cell[ishunt], minlength=g * g) > 0
            st = self.state; self.timer = np.maximum(0, self.timer - dt)
            tplh = np.array([T["hunter"] for T in TEMPLATES])[self.tpl]
            tpld = np.array([T["drift"] for T in TEMPLATES])[self.tpl]
            threat = hcell[cell] & ~ishunt & (D["vision"] > 0.05)
            st[:] = np.where(self.timer > 0, st, np.where(threat, 2, np.where(e > 1.25, 3, np.where(e < 0.9, 1, 0))))
            # 0 roam/patrol/drift, 1 graze/stalk+chase/feed, 2 flee, 3 rest/digest/bud
            move_m = np.select([st == 0, st == 1, st == 2, st == 3], [1.0, 0.8, 2.0, 0.2])
            loco_m = np.select([st == 0, st == 1, st == 2, st == 3], [1.0, 0.9, 1.6, 0.25])
            hunt_m = np.select([st == 1, st == 0, st == 3], [1.6, 0.6, 0.0], 0.0) * np.where(tplh, 1.0, 0.5)
            vuln_m = np.where(st == 2, 0.5, 1.0)
            move_m = np.where(tpld, move_m * 0.5, move_m); loco_m = np.where(tpld, loco_m * 0.6, loco_m)
        # --- costs (per mass per s) -> energy
        basal = C["b0"] * rate * (1 + 0.8 * D["o"])
        eye = C["k_eye"] * D["A"] ** 2 * C["b0"] * 5
        dis = C["k_dis"] * SEA[env["sea"]]["atk_si"] * D["si"] * (1 - D["cover"]) * np.where(mode == 3, 0.3, 1.0)
        hs = C["k_heat"] * max(0, heat - 0.5) * np.minimum(D["S"], 3) * C["b0"]
        cost = (basal + eye + C["k_loco"] * loco * loco_m * rate + hs) * kl + dis
        # --- grazing (food-limited per cell)
        demand = C["i0"] * (1 - C["hunger_scarcity"] * H) * (1 - D["t"]) ** 1.5 * kl * M * dt * np.where(mode == 3, C["float_graze"], 1.0)
        Dcell = np.bincount(cell, demand, g * g)
        frac = np.minimum(1.0, self.food / np.maximum(Dcell, 1e-12))
        take = demand * frac[cell] * np.minimum(1.0, self.food[cell] / (0.3 * self.K) + 0.2)
        self.food = np.maximum(0, self.food - np.bincount(cell, take, g * g))
        self.E += take - cost * M * dt
        # --- predation
        dead = np.zeros(n, bool)
        hunters = np.nonzero(D["t"] > 0.25)[0]
        if self.cheats and not self.meat_fired and H > 0.6 and self.t > 40 and not (D["t"] >= 0.6).any():
            j = rng.integers(n); self.G[j, DIET] = 0.75; self.G[j, GAPE] = max(self.G[j, GAPE], 0.6)
            D["t"][j] = 0.75; self.meat_fired = True
        if len(hunters):
            order = np.argsort(cell, kind="stable"); sc = cell[order]
            start = np.searchsorted(sc, np.arange(g * g)); cnt = np.bincount(cell, minlength=g * g)
            # search the 3x3 neighbourhood (F: neighbour query radius = vision); one random cell per try
            hx, hy = cell[hunters] // g, cell[hunters] % g
            oc = ((hx + rng.integers(-1, 2, len(hunters))) % g) * g + (hy + rng.integers(-1, 2, len(hunters))) % g
            k = cnt[oc] - (oc == cell[hunters])
            p_try = 1 - np.exp(-C["beta_enc"] * hunt_m[hunters] * (0.5 + H) * D["t"][hunters] * k * 9 *
                               (D["vision"][hunters] + D["S"][hunters]) * dt)
            tr = (rng.random(len(hunters)) < p_try) & (k > 0)
            hu = hunters[tr]; ocu = oc[tr]
            if len(hu):
                pick = order[start[ocu] + rng.integers(0, cnt[ocu])]
                ok = pick != hu
                hu, pr = hu[ok], pick[ok]
                _, first = np.unique(pr, return_index=True); hu, pr = hu[first], pr[first]
                Sh, Sp = D["S"][hu], D["S"][pr]
                edible = (Sp * 0.8 < D["gape"][hu]) & ((D["mode"][pr] != 3) | (D["mode"][hu] == 3))
                if C["no_cannibal"]:  # [game] carnivores (t >= 0.5) don't eat carnivores
                    edible &= D["t"][pr] < 0.5
                att = D["t"][hu] * (1 + 2 * D["hornrel"][hu]) * np.sqrt(Sh / Sp)
                dfn = 0.3 + 1.5 * D["cover"][pr] + 0.5 * D["si"][pr] + 1.0 * D["hornrel"][pr] \
                    + 0.3 * self.G[pr, DDENS] * D["si"][pr] - 0.3 * (D["mode"][pr] == 3)
                dfn = np.maximum(dfn, 0.05)
                vh = Sh ** 0.5 / np.minimum(walk[hu], C["crawl"]) ** 0.5
                vp = Sp ** 0.5 / np.minimum(walk[pr], C["crawl"]) ** 0.5
                det = np.minimum(1, D["vision"][pr] / (D["vision"][hu] + 0.05))
                p_win = att / (att + dfn) * vh / (vh + vp * det) * vuln_m[pr]
                win = edible & (rng.random(len(hu)) < p_win) & ~dead[hu]
                gain = C["meat_eff"] * D["t"][hu] * (0.3 + 0.6 * H) * (np.maximum(self.E[pr], 0) + 0.5 * D["M"][pr])
                self.E[hu[win]] += gain[win]
                if self.guided:  # hunter FSM: eat -> rest (digest) for 2 s
                    self.state[hu[win]] = 3; self.timer[hu[win]] = 2.0
                dead[pr[win]] = True; self.kills += int(win.sum())
                lose = edible & ~win
                self.E[hu[lose]] -= C["counter"] * D["hornrel"][pr[lose]] * D["M"][hu[lose]]
        # --- movement toward richer neighbour cells
        sp = 1.0 * D["S"] ** 0.5 / np.sqrt(loco) * (1 + 0.4 * D["o"]) * rate
        ang = rng.uniform(0, 2 * np.pi, n)
        dx, dy = np.cos(ang), np.sin(ang)
        nx = (np.floor((self.x + dx * cs + W / 2) / cs).astype(int)) % g
        ny = (np.floor((self.y + dy * cs + W / 2) / cs).astype(int)) % g
        better = self.food[nx * g + ny] > self.food[cell] * 1.1
        # carnivores (t >= 0.5) steer toward prey density instead of plants (F: chase weight Hunger*t)
        dens = np.bincount(cell, minlength=g * g)
        carn = D["t"] >= 0.5
        better = np.where(carn, dens[nx * g + ny] > dens[cell], better)
        mv = sp * dt * np.where(better, 1.0, 0.4) * move_m
        self.x = (self.x + dx * mv + W / 2) % W - W / 2
        self.y = (self.y + dy * mv + W / 2) % W - W / 2
        # --- producers regrow (logistic, Light), corpses recycle
        r = C["food_r"] * (0.2 + light)
        self.food += r * (self.K - self.food) * (0.3 + 0.7 * self.food / self.K) * dt
        # --- death
        self.age += dt
        life = 30 * D["S"] ** 0.25 / rate
        # senescence hazard: mean lifespan = life (F: 30 s * S^0.25 / rate), spread to avoid cohort waves
        old = (self.age > 0.8 * life) & (rng.random(n) < dt / (0.4 * life))
        dead |= (self.E <= 0) | old | (self.age > 1.6 * life)
        if dead.any():
            self.food += np.bincount(cell[dead], 0.3 * D["M"][dead], g * g)
            np.minimum(self.food, self.K * 1.5, out=self.food)
        # --- reproduction (asexual budding)
        mature = self.age > 3 * D["S"] ** 0.25 / rate
        rep = np.nonzero((self.E > 1.5 * M) & mature & ~dead)[0]
        room = self.cap - (n - dead.sum())
        if len(rep) > room:
            rep = rng.choice(rep, max(0, room), replace=False) if room > 0 else rep[:0]
        if len(rep):
            litter = 1 + np.floor(3 * (1 - self.G[rep, RK])).astype(int)
            E_rep = self.E[rep] - 0.5 * M[rep]
            self.E[rep] = 0.5 * M[rep]
            par = np.repeat(rep, litter)
            each = np.repeat(0.8 * E_rep / litter, litter)
            par = par[: max(0, room)]; each = each[: len(par)]
            G2, s2, c2 = self._mutate(self.G[par], self.segN[par], self.comp[par], self.tpl[par])
            t2 = self._tpl_out if self.guided else self.tpl[par]
            D2 = develop(G2, s2, c2, env)
            build = C["plate_build"] * D2["cover"] / (0.2 + D2["si"]) * D2["M"]
            E2 = each - build
            # offspring energy is absolute; must exceed 0.2 of own mass
            ok = E2 > 0.2 * D2["M"]
            par, G2, s2, c2, E2, t2 = par[ok], G2[ok], s2[ok], c2[ok], E2[ok], t2[ok]
            self.births += len(par)
            alive = ~dead
            self.G = np.concatenate([self.G[alive], G2]); self.segN = np.concatenate([self.segN[alive], s2])
            self.comp = np.concatenate([self.comp[alive], c2])
            self.x = np.concatenate([self.x[alive], self.x[par] + rng.normal(0, 0.5, len(par))])
            self.y = np.concatenate([self.y[alive], self.y[par] + rng.normal(0, 0.5, len(par))])
            self.E = np.concatenate([self.E[alive], E2]); self.age = np.concatenate([self.age[alive], np.zeros(len(par))])
            self.depth = np.concatenate([self.depth[alive], self.depth[par] + 1])
            self.tpl = np.concatenate([self.tpl[alive], t2])
            self.state = np.concatenate([self.state[alive], np.zeros(len(par), int)])
            self.timer = np.concatenate([self.timer[alive], np.zeros(len(par))])
        else:
            alive = ~dead
            for a in ("G", "segN", "comp", "x", "y", "E", "age", "depth", "tpl", "state", "timer"):
                setattr(self, a, getattr(self, a)[alive])
        self._derive_all()
        self.D["mode"] = np.zeros(len(self.G), int) if len(self.G) else self.D["mode"]
        self.t += dt

    def modes(self):
        """Recompute locomotion mode for the current population (for measurement)."""
        D = self.D; n = len(self.G)
        if n == 0:
            return np.zeros(0, int)
        g, cs, W = self.g, self.cs, C["world"]
        cell = ((np.floor((self.x + W / 2) / cs).astype(int) % g) * g + np.floor((self.y + W / 2) / cs).astype(int) % g)
        walk = np.minimum(np.where(D["npairs"] > 0, 1.0 / (np.sqrt(2 * D["npairs"]) * D["lenrel"] + 1e-9), C["crawl"]), C["crawl"])
        swim = np.where(self.liquid[cell], C["swim"] / (1 + 0.6 * D["c"] * np.minimum(D["segN"], 12) / 12), 1e9)
        flt = C["float_h"] + C["k_hover"] * np.maximum(0, D["rho_body"] - D["rho_air"]) / C["k_loco"]
        return np.argmin(np.stack([walk, swim, np.full(n, 1e9), flt], 1), 1)


def species_count(G, segN, rng, thr=0.55, sample=300):
    if len(G) == 0:
        return 0
    idx = rng.choice(len(G), min(sample, len(G)), replace=False)
    V = np.concatenate([G[idx], (segN[idx] / 16.0)[:, None] * 2], 1)
    leaders, counts = [], []
    for v in V:
        if leaders:
            d = np.linalg.norm(np.array(leaders) - v, axis=1); j = int(np.argmin(d))
            if d[j] < thr:
                counts[j] += 1; continue
        leaders.append(v); counts.append(1)
    return int(sum(c >= 3 for c in counts))


def template_progress(sim):
    """Per agent: lineage template (guided) or nearest template (open-ended) and progress 0..1
    from the founder worm toward that template's genes + segment count."""
    n = len(sim.G); K = len(TEMPLATES)
    prog = np.zeros((n, K))
    for k, T in enumerate(TEMPLATES):
        idx = np.array(list(T["genes"].keys())); tgt = np.array(list(T["genes"].values()))
        d0 = np.sqrt(((sim.base[idx] - tgt) ** 2).sum() + ((sim.L0 - T["seg"]) / 13) ** 2)
        d = np.sqrt(((sim.G[:, idx] - tgt) ** 2).sum(1) + ((sim.segN - T["seg"]) / 13) ** 2)
        prog[:, k] = 1 - d / max(d0, 1e-9)
    who = sim.tpl if sim.guided else np.argmax(prog, 1)
    return who, prog[np.arange(n), who]


def morph_bins(sim):
    """MAP-Elites-style body-plan bins (F §9 M7, reduced): mode x legs x armour x horn x diet x size."""
    D = sim.D
    diet = np.digitize(D["t"], [0.35, 0.6]); size = np.digitize(D["S"], [0.5, 2.0])
    legs = np.minimum(D["npairs"], 2)
    key = (((((D["mode"] * 3 + legs) * 2 + (D["cover"] >= 0.35)) * 2 + (D["hornrel"] >= 0.3)) * 3 + diet) * 3 + size)
    u, c = np.unique(key, return_counts=True)
    return {int(a): int(b) for a, b in zip(u, c)}


TRAITS = ["legs2", "horns", "plates3", "eyes", "buoyant", "buoyant_giant", "long8", "hunter"]


def run(preset, cap, mut_mult, dup, seed, T, cheats=False, dt=None, founder_var=0.03, guided=False, pull=0.1):
    sim = Sim(preset, cap, mut_mult, dup, seed, cheats, founder_var, dt, guided, pull)
    KT = len(TEMPLATES); tpl20 = [None] * KT; tpl_first = [None] * KT
    rng = np.random.default_rng(seed + 999)
    first = {k: None for k in TRAITS}; p20 = {k: None for k in TRAITS}
    gen_at = {}
    hunter_tier = None; ht_run = 0
    timeline = []; minN_after60 = None; extinct_t = None
    t0 = time.perf_counter(); ticks = 0; next_sample = 0.0
    legs_any_t = None; band_n = 0; band_in = 0
    while sim.t < T:
        if sim.cheats and legs_any_t is None and sim.t >= 30 and sim.midwife_until < 0:
            if not (sim.D["npairs"] > 0).any():
                sim.midwife_until = sim.t + 15
        sim.step(); ticks += 1
        n = len(sim.G)
        if n == 0:
            extinct_t = sim.t; break
        if sim.t + 1e-9 >= next_sample:
            next_sample += 1.0
            sim.D["mode"] = sim.modes()
            fl = traits_flags(sim.D)
            if legs_any_t is None and (sim.D["npairs"] > 0).any():
                legs_any_t = sim.t
            for k in TRAITS:
                c = int(fl[k].sum())
                if c and first[k] is None:
                    first[k] = round(sim.t, 2)
                if p20[k] is None and n >= 20 and c / n >= 0.2:
                    p20[k] = round(sim.t, 2); gen_at[k] = float(np.mean(sim.depth))
            who, prog = template_progress(sim)
            for k in range(KT):
                m = who == k
                if m.sum() >= 10:
                    formed = (prog[m] >= 0.8).mean()
                    if tpl_first[k] is None and formed > 0:
                        tpl_first[k] = round(sim.t, 2)
                    if tpl20[k] is None and formed >= 0.2:
                        tpl20[k] = round(sim.t, 2)
            t = sim.D["t"]
            ng, no, nh = int((t < 0.35).sum()), int(((t >= 0.35) & (t < 0.6)).sum()), int((t >= 0.6).sum())
            ht_run = ht_run + 1 if nh >= 0.05 * n else 0
            if sim.t > 60:
                band_n += 1; band_in += int(0.05 <= nh / n <= 0.35)
            if hunter_tier is None and ht_run >= 10:
                hunter_tier = round(sim.t - 9, 2)
            if sim.t > 60:
                minN_after60 = n if minN_after60 is None else min(minN_after60, n)
            if int(round(sim.t)) % 10 == 0:
                timeline.append(dict(t=int(round(sim.t)), N=n, grazers=ng, omni=no, hunters=nh,
                                     food=round(float(sim.food.sum() / (sim.K * sim.g ** 2)), 3),
                                     gen=round(float(np.mean(sim.depth)), 1),
                                     species=species_count(sim.G, sim.segN, rng),
                                     float_frac=round(float((sim.D["mode"] == 3).mean()), 3),
                                     meanS=round(float(np.median(sim.D["S"])), 3),
                                     tpl_census=np.bincount(who, minlength=KT).tolist(),
                                     tpl_prog=[round(float(prog[who == k].mean()), 2) if (who == k).any() else None
                                               for k in range(KT)]))
    wall = time.perf_counter() - t0
    if len(sim.G):
        sim.D["mode"] = sim.modes()
    bins = morph_bins(sim) if len(sim.G) else {}
    who, prog = template_progress(sim) if len(sim.G) else (np.zeros(0, int), np.zeros(0))
    sims = sim.t
    stable = extinct_t is None and (minN_after60 or 0) >= 0.1 * cap
    return dict(preset=preset, cap=cap, mut_mult=mut_mult, dup=dup, seed=seed, cheats=cheats,
                mode="guided" if guided else "open", pull=pull if guided else None,
                affinity=[round(float(a), 2) for a in sim.aff],
                tpl_first=dict(zip([T["name"] for T in TEMPLATES], tpl_first)),
                tpl_p20=dict(zip([T["name"] for T in TEMPLATES], tpl20)),
                final_bins=bins,
                final_tpl_census=dict(zip([T["name"] for T in TEMPLATES], np.bincount(who, minlength=KT).tolist())),
                final_formed=dict(zip([T["name"] for T in TEMPLATES],
                                      [int(((who == k) & (prog >= 0.8)).sum()) for k in range(KT)])),
                dt=sim.dt, T=round(sims, 1), first=first, p20=p20, gen_at_p20=gen_at,
                hunter_tier=hunter_tier, kills=sim.kills, births=sim.births,
                hunter_band_frac=round(band_in / band_n, 3) if band_n else None,
                stable=bool(stable), extinct_t=extinct_t, minN_after60=minN_after60,
                final_N=len(sim.G), final_gen=round(float(np.mean(sim.depth)), 1) if len(sim.G) else None,
                wall_s=round(wall, 2), wall_ms_per_sim_s=round(1000 * wall / max(sims, 1e-9), 2),
                ticks=ticks, timeline=timeline)


def _run_star(a):
    return run(**a)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--one", action="store_true"); ap.add_argument("--sweep", action="store_true")
    ap.add_argument("--preset", default="earth"); ap.add_argument("--cap", type=int, default=1000)
    ap.add_argument("--mut", type=float, default=1.0); ap.add_argument("--nodup", action="store_true")
    ap.add_argument("--guided", action="store_true"); ap.add_argument("--pull", type=float, default=0.1)
    ap.add_argument("--cheats", action="store_true"); ap.add_argument("--dt", type=float, default=None)
    ap.add_argument("--seed", type=int, default=0); ap.add_argument("--T", type=float, default=600)
    ap.add_argument("--procs", type=int, default=8); ap.add_argument("--out", default=None)
    ap.add_argument("--presets", default="earth,silicon,dusk,frozen,rhino")
    ap.add_argument("--caps", default="300,1000,3000"); ap.add_argument("--seeds", type=int, default=3)
    a = ap.parse_args()
    if a.one:
        r = run(a.preset, a.cap, a.mut, not a.nodup, a.seed, a.T, a.cheats, a.dt, guided=a.guided, pull=a.pull)
        tl = r.pop("timeline")
        print(json.dumps(r, indent=1))
        for row in tl[:: max(1, len(tl) // 15)]:
            print(row)
    elif a.sweep:
        from multiprocessing import Pool
        jobs = []
        for p, cap, mm, dup, s in itertools.product(a.presets.split(","), [int(c) for c in a.caps.split(",")],
                                                    [1.0, 2.5], [True, False], range(a.seeds)):
            jobs.append(dict(preset=p, cap=cap, mut_mult=mm, dup=dup, seed=s, T=a.T))
        for p, s in itertools.product(a.presets.split(","), range(a.seeds)):  # declared cheats on
            jobs.append(dict(preset=p, cap=1000, mut_mult=2.5, dup=True, seed=s, T=a.T, cheats=True))
        for p, cap, pull, s in itertools.product(a.presets.split(","), [1000, 3000], [0.1, 0.25], range(a.seeds)):
            jobs.append(dict(preset=p, cap=cap, mut_mult=1.0, dup=True, seed=s, T=min(a.T, 900), guided=True, pull=pull))
        jobs.sort(key=lambda j: -j["cap"])
        t0 = time.time()
        with Pool(a.procs) as pool:
            res = []
            for i, r in enumerate(pool.imap_unordered(_run_star, jobs)):
                res.append(r); print(f"{i+1}/{len(jobs)} {r['preset']} cap{r['cap']} m{r['mut_mult']} dup{r['dup']} "
                                     f"s{r['seed']} wall {r['wall_s']}s", flush=True)
        json.dump(dict(coefficients=C, presets=PRESETS, sea=SEA, runs=res, sweep_wall_s=round(time.time() - t0, 1)),
                  open(a.out, "w"))
        print("wrote", a.out)
