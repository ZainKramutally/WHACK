#!/usr/bin/env python3
"""Toy stochastic bonding model: do real bond energies give non-degenerate worlds?

Research script, not app code. numpy only. Well-mixed (no space): atoms meet at
random, bond if they have free valence, and bonds break by
  p_break = k0 * exp(-E / kT_eff) * sink(bond)  +  attack[solvent][bond] * kin(T)
Hydrolysis (solvent attack) breaks the bond and caps each freed X valence with
an O ("OH" from the solvent reservoir). X–O bonds/caps are the oxygen sink.

Effective temperature: kT_eff = R*T*S/1000 kJ/mol with a single global scale S
(default 16, so 300 K -> ~40 kJ/mol). Real kT at 300 K is 2.49 kJ/mol, which
makes every bond in the table effectively permanent; S compresses that gap so a
run finishes in seconds. The SAME S is used for every scenario, so relative
temperature differences (94 K vs 300 K vs 330 K) are preserved.

Run:  python3 research/silicon-life/prototype/bonding_model.py          (all + sweep)
      python3 research/silicon-life/prototype/bonding_model.py --quick  (no sweep)
"""
import json
import sys
import time
from pathlib import Path

import numpy as np

R = 8.314e-3  # kJ/mol/K

# Petkowski 2020 Table 1 (data/silicon.json), kJ/mol
BOND_E = {
    ("C", "C"): 346, ("Si", "Si"): 222, ("C", "Si"): 318,
    ("C", "H"): 411, ("Si", "H"): 318,
    ("C", "O"): 358, ("Si", "O"): 452,
}
TYPES = ["C", "Si", "H", "O"]
VALENCE = {"C": 4, "Si": 4, "H": 1, "O": 2}
T_IDX = {t: i for i, t in enumerate(TYPES)}

# Solvent attack per bond per step at the reference kinetics (toy numbers chosen
# to encode the qualitative ordering from notes 01/02, not measured rates):
#  water: Si(δ+) bonds hydrolyse (Si–Si, Si–H fast; Si–C stable); C bonds inert.
#  H2SO4: electrophilic; Si–Si MORE stable than Si–C; slow Si–H; slight C charring.
#  methane/N2: aprotic, non-polar -> essentially no attack.
ATTACK = {
    "water":   {("Si", "Si"): 1e-2, ("Si", "H"): 6e-3, ("C", "Si"): 2e-4},
    "h2so4":   {("Si", "Si"): 4e-4, ("Si", "H"): 1.5e-3, ("C", "Si"): 1.5e-3,
                ("C", "C"): 1e-4, ("C", "H"): 1e-4},
    "methane": {("Si", "Si"): 1e-6, ("Si", "H"): 1e-6},
    "none":    {},
}
CAPS_FROM_SOLVENT = {"water": True, "h2so4": True, "methane": False, "none": False}


def key(a, b):
    return tuple(sorted((a, b), key=lambda t: TYPES.index(t)))


def make_tables(si_si_mult=1.0):
    n = len(TYPES)
    E = np.zeros((n, n))
    allowed = np.zeros((n, n), bool)
    for (a, b), e in BOND_E.items():
        if (a, b) == ("Si", "Si"):
            e = e * si_si_mult
        for x, y in ((a, b), (b, a)):
            E[T_IDX[x], T_IDX[y]] = e
            allowed[T_IDX[x], T_IDX[y]] = True
    return E, allowed


def attack_table(solvent):
    n = len(TYPES)
    A = np.zeros((n, n))
    for (a, b), r in ATTACK[solvent].items():
        A[T_IDX[a], T_IDX[b]] = A[T_IDX[b], T_IDX[a]] = r
    return A


def components(n, bi, bj):
    """Connected-component labels via min-label propagation + pointer jumping."""
    lab = np.arange(n)
    if len(bi) == 0:
        return lab
    while True:
        old = lab.copy()
        m = np.minimum(lab[bi], lab[bj])
        np.minimum.at(lab, bi, m)
        np.minimum.at(lab, bj, m)
        lab = lab[lab]
        lab = lab[lab]
        if np.array_equal(lab, old):
            return lab


def run(name, backbone, solvent, T, frac, steps=3000, N=3000, S=16.0, k0=1.0,
        si_si_mult=1.0, sink=0.05, Ea_kin=40.0, enc_rate=0.08, seed=1,
        record_every=30):
    rng = np.random.default_rng(seed)
    kT = R * T * S
    kT_ref = R * 300.0 * S
    kin = float(np.exp(-Ea_kin / kT + Ea_kin / kT_ref))  # rel. reaction rate vs 300 K
    E, allowed = make_tables(si_si_mult)
    A = attack_table(solvent)
    caps_on = CAPS_FROM_SOLVENT[solvent]

    counts = {t: int(round(frac.get(t, 0) * N)) for t in TYPES}
    typ = np.concatenate([np.full(c, T_IDX[t]) for t, c in counts.items()]).astype(np.int8)
    N = len(typ)
    val = np.array([VALENCE[t] for t in TYPES])[typ]
    isX = (typ == T_IDX["C"]) | (typ == T_IDX["Si"])
    O_i = T_IDX["O"]

    deg = np.zeros(N, int)
    cap = np.zeros(N, int)            # solvent O caps (X–OH)
    bi = np.zeros(0, int)
    bj = np.zeros(0, int)
    pairs = set()

    # per-type cap revert probability (X–O, damped by sink factor)
    cap_rev = np.zeros(len(TYPES))
    for t in ("C", "Si"):
        cap_rev[T_IDX[t]] = min(1.0, k0 * np.exp(-E[T_IDX[t], O_i] / kT) * sink)

    series = []
    breaks_total = 0
    t0 = time.time()
    for step in range(steps + 1):
        # ---- breaking --------------------------------------------------------
        if len(bi):
            ti, tj = typ[bi], typ[bj]
            Eb = E[ti, tj]
            isO = (ti == O_i) | (tj == O_i)
            p = k0 * np.exp(-Eb / kT) * np.where(isO, sink, 1.0) + A[ti, tj] * kin
            br = rng.random(len(bi)) < np.minimum(p, 1.0)
            if br.any():
                hyd = br & (rng.random(len(bi)) < (A[ti, tj] * kin) / np.maximum(p, 1e-30))
                for a, b in zip(bi[br], bj[br]):
                    pairs.discard((a, b) if a < b else (b, a))
                np.subtract.at(deg, bi[br], 1)
                np.subtract.at(deg, bj[br], 1)
                if caps_on and hyd.any():
                    for side in (bi[hyd], bj[hyd]):
                        xs = side[isX[side]]
                        np.add.at(cap, xs, 1)
                breaks_total += int(br.sum())
                bi, bj = bi[~br], bj[~br]
        # caps revert (Si–OH -> Si radical + solvent): near-permanent
        cm = cap > 0
        if cm.any():
            cap[cm] -= rng.binomial(cap[cm], cap_rev[typ[cm]])

        # ---- forming ---------------------------------------------------------
        K = rng.poisson(enc_rate * N * kin)
        if K:
            a = rng.integers(0, N, K)
            b = rng.integers(0, N, K)
            ok = (a != b) & allowed[typ[a], typ[b]]
            ok &= (deg[a] + cap[a] < val[a]) & (deg[b] + cap[b] < val[b])
            # affinity ~ bond energy (exothermicity), so O sinks win encounters
            ok &= rng.random(K) < E[typ[a], typ[b]] / 500.0
            na, nb = [], []
            for x, y in zip(a[ok], b[ok]):
                if deg[x] + cap[x] >= val[x] or deg[y] + cap[y] >= val[y]:
                    continue
                pk = (x, y) if x < y else (y, x)
                if pk in pairs:
                    continue
                pairs.add(pk)
                deg[x] += 1
                deg[y] += 1
                na.append(x)
                nb.append(y)
            if na:
                bi = np.concatenate([bi, np.array(na, int)])
                bj = np.concatenate([bj, np.array(nb, int)])

        if step % record_every == 0 or step == steps:
            series.append(measure(step, typ, isX, cap, bi, bj, N, breaks_total))
            breaks_total = 0

    final = series[-1]
    hist = chain_hist(typ, isX, bi, bj, N)
    return {
        "name": name,
        "params": dict(backbone=backbone, solvent=solvent, T_K=T, composition=counts,
                       N=N, steps=steps, S=S, kT_eff_kJmol=round(kT, 2), kin_factor=round(kin, 4),
                       k0=k0, si_si_mult=si_si_mult, sink=sink, Ea_kin=Ea_kin,
                       enc_rate=enc_rate, seed=seed,
                       attack=dict((f"{a}-{b}", r) for (a, b), r in ATTACK[solvent].items())),
        "series": downsample(series, 100),
        "final": final,
        "chain_hist": hist,
        "runtime_s": round(time.time() - t0, 2),
    }


def measure(step, typ, isX, cap, bi, bj, N, breaks):
    lab = components(N, bi, bj)
    sizes = np.bincount(lab, minlength=N)
    largest = int(sizes.max()) if N else 0
    # backbone = X–X subgraph
    xx = isX[bi] & isX[bj]
    blab = components(N, bi[xx], bj[xx])
    bsz = np.bincount(blab[isX], minlength=N)
    largest_chain = int(bsz.max()) if isX.any() else 0
    # dead X: >=2 of 4 valence slots bound to O (explicit or cap)
    O_i = T_IDX["O"]
    nO = cap.copy()
    for s, o in ((bi, bj), (bj, bi)):
        m = typ[o] == O_i
        np.add.at(nO, s[m], 1)
    dead = float((nO[isX] >= 2).mean()) if isX.any() else 0.0
    # species: molecules with >=1 X and size >=3, keyed by composition + X–X bonds
    #  + X degree multiset (crude 1-round WL-ish fingerprint)
    deg_xx = np.zeros(N, int)
    np.add.at(deg_xx, bi[xx], 1)
    np.add.at(deg_xx, bj[xx], 1)
    order = np.argsort(lab, kind="stable")
    ls = lab[order]
    starts = np.flatnonzero(np.r_[True, ls[1:] != ls[:-1]])
    ends = np.r_[starts[1:], len(ls)]
    species = set()
    complex_mols = 0
    n_xxb = np.bincount(lab[bi[xx]], minlength=N)
    for s0, e0 in zip(starts, ends):
        if e0 - s0 < 3:
            continue
        idx = order[s0:e0]
        if not isX[idx].any():
            continue
        comp = tuple(np.bincount(typ[idx], minlength=4)) + (int(cap[idx].sum()),)
        dx = tuple(np.bincount(deg_xx[idx[isX[idx]]], minlength=5)[:5])
        species.add((comp, int(n_xxb[ls[s0]]), dx))
        if n_xxb[ls[s0]] >= 3:
            complex_mols += 1
    return dict(step=step, largest_molecule=largest, largest_chain=largest_chain,
                species_count=len(species), complex_molecules=complex_mols,
                dead_fraction=round(dead, 4), bonds=int(len(bi)), breaks=breaks)


def chain_hist(typ, isX, bi, bj, N):
    xx = isX[bi] & isX[bj]
    blab = components(N, bi[xx], bj[xx])
    sz = np.bincount(blab[isX], minlength=N)
    sz = sz[sz > 0]
    bins = [1, 2, 3, 4, 6, 9, 17, 33, 65, 10**9]
    labels = ["1", "2", "3", "4-5", "6-8", "9-16", "17-32", "33-64", "65+"]
    h = np.histogram(sz, bins=bins)[0]
    return dict(zip(labels, map(int, h)))


def downsample(series, n):
    if len(series) <= n:
        return series
    idx = np.unique(np.linspace(0, len(series) - 1, n).round().astype(int))
    return [series[i] for i in idx]


BASE = {"H": 0.45, "O": 0.10}

SCENARIOS = [
    ("1_carbon_water_300K", "C", "water", 300, {"C": 0.45, **BASE}, {}),
    ("2_silicon_water_300K", "Si", "water", 300, {"Si": 0.45, **BASE}, {}),
    ("3_silicon_methane_94K", "Si", "methane", 94, {"Si": 0.45, **BASE}, {}),
    ("4_silicon_h2so4_330K_hybrid", "Si+C", "h2so4", 330,
     {"Si": 0.27, "C": 0.18, **BASE}, {}),
    ("5a_silicon_water_300K_SiSi+50", "Si", "water", 300, {"Si": 0.45, **BASE},
     {"si_si_mult": 1.5}),
    ("5b_silicon_none_300K_SiSi+50", "Si", "none", 300, {"Si": 0.45, **BASE},
     {"si_si_mult": 1.5}),
    ("5c_silicon_methane_94K_SiSi+50", "Si", "methane", 94, {"Si": 0.45, **BASE},
     {"si_si_mult": 1.5}),
    ("6_carbon_water_300K_O_free", "C", "water", 300, {"C": 0.45, "H": 0.55}, {}),
    ("ctrl_silicon_none_300K", "Si", "none", 300, {"Si": 0.45, **BASE}, {}),
]


def sweep():
    """Final metrics vs effective-temperature scale S (kT_eff at 300 K = 2.49*S)."""
    out = []
    for name, bb, solv, T, frac, kw in [SCENARIOS[0], SCENARIOS[1], SCENARIOS[2],
                                        SCENARIOS[3], SCENARIOS[8]]:
        for S in (6, 10, 13, 16, 20, 26, 34):
            r = run(name, bb, solv, T, frac, steps=1500, N=2000, S=S, record_every=1500, **kw)
            f = r["final"]
            out.append(dict(scenario=name, S=S, kT_eff_kJmol=r["params"]["kT_eff_kJmol"],
                            largest_chain=f["largest_chain"], species=f["species_count"],
                            complex=f["complex_molecules"], dead=f["dead_fraction"],
                            turnover_per_bond=round(f["breaks"] / max(1, f["bonds"]) / 1500, 6)))
            print(f"  sweep {name:32s} S={S:3d} kT={out[-1]['kT_eff_kJmol']:6.1f} "
                  f"chain={f['largest_chain']:4d} spp={f['species_count']:4d} "
                  f"cplx={f['complex_molecules']:4d} dead={f['dead_fraction']:.2f}")
    return out


def extras():
    """Two follow-up levers: H:X ratio (anti-gel) and water attack scale (death pacing)."""
    out = {"h_fraction": [], "water_attack_scale": []}
    for h in (0.45, 0.6, 0.7):
        for bb in ("C", "Si"):
            r = run("h", bb, "none", 300, {bb: 0.9 - h, "H": h, "O": 0.1}, steps=1500, N=2000,
                    record_every=1500)
            f = r["final"]
            out["h_fraction"].append(dict(H=h, backbone=bb, largest_chain=f["largest_chain"],
                                          species=f["species_count"], complex=f["complex_molecules"]))
    base = dict(ATTACK["water"])
    for sc in (1, 0.1, 0.03, 0.01):
        ATTACK["water"] = {k: v * sc for k, v in base.items()}
        r = run("w", "Si", "water", 300, {"Si": 0.45, **BASE}, steps=3000, N=2000)
        ser = r["series"]
        pk = max(ser, key=lambda d: d["largest_chain"])
        out["water_attack_scale"].append(dict(
            scale=sc, peak_chain=pk["largest_chain"], peak_step=pk["step"],
            peak_species=max(d["species_count"] for d in ser),
            step_dead_50=next((d["step"] for d in ser if d["dead_fraction"] >= 0.5), None),
            final_chain=ser[-1]["largest_chain"], final_dead=ser[-1]["dead_fraction"]))
    ATTACK["water"] = base
    print(json.dumps(out, indent=None))
    return out


def main():
    quick = "--quick" in sys.argv
    results = []
    for name, bb, solv, T, frac, kw in SCENARIOS:
        r = run(name, bb, solv, T, frac, **kw)
        f = r["final"]
        mid = r["series"][len(r["series"]) // 5]  # ~20% of the run ("first 60 s")
        print(f"{name:34s} kT={r['params']['kT_eff_kJmol']:5.1f} kin={r['params']['kin_factor']:.3f} "
              f"| @20%: chain={mid['largest_chain']:4d} spp={mid['species_count']:4d} "
              f"| final: chain={f['largest_chain']:4d} mol={f['largest_molecule']:4d} "
              f"spp={f['species_count']:4d} cplx={f['complex_molecules']:4d} "
              f"dead={f['dead_fraction']:.2f} brk={f['breaks']:5d} ({r['runtime_s']}s)")
        results.append(r)
    out = {"model": "toy well-mixed stochastic bonding; see notes/07-prototype-findings.md",
           "bond_energies_kJmol": {f"{a}-{b}": e for (a, b), e in BOND_E.items()},
           "scenarios": results}
    if not quick:
        out["S_sweep"] = sweep()
        out["extras"] = extras()
    path = Path(__file__).resolve().parents[1] / "data" / "prototype-results.json"
    path.write_text(json.dumps(out, indent=1, default=int))
    print("wrote", path)


if __name__ == "__main__":
    main()
