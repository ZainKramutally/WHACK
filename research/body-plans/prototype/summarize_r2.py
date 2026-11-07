"""Round 2: aggregate hybrid-engine runs into the round2 block of data/time-to-trait.json."""
import json, sys, itertools, statistics
from collections import defaultdict
from summarize import med, l1, demo_s, demo_hybrid

TRAITS = ["legs2", "horns", "plates3", "eyes", "buoyant", "buoyant_giant", "long8"]


def main(raw, out, block="round2"):
    R = json.load(open(raw)); runs = R["runs"]
    groups = defaultdict(list)
    for r in runs:
        groups[(r["preset"], r["cap"], r["r2"]["kappa"], r["r2"]["niches"])].append(r)
    configs = []
    for (preset, cap, kappa, niches), rs in sorted(groups.items(), key=lambda kv: str(kv[0])):
        n = len(rs)
        def both(t):
            return dict(sim_s=t, demo_hybrid=demo_hybrid(t), demo_x3=demo_s(t, 3))
        tr = {}
        for t in TRAITS:
            v, k = med([r["p20"][t] for r in rs], n); tr[t] = dict(**both(v), seeds=k)
        v, k = med([r["hunter_tier"] for r in rs], n); tr["hunter_tier_5pct"] = dict(**both(v), seeds=k)
        co = {}
        for key in ("first", "p5", "p20"):
            v, k = med([r["r2"]["cooccur"][key] for r in rs], n); co[key] = dict(**both(v), seeds=k)
        basins = {}
        names = list(rs[0]["r2"]["basin_p20"]) or [b["name"] for b in R["basins"]]
        for b in names:
            v20, k20 = med([r["r2"]["basin_p20"].get(b) for r in rs], n)
            v5, k5 = med([r["r2"]["basin_present5"].get(b) for r in rs], n)
            basins[b] = dict(formed20_of_captured=dict(**both(v20), seeds=k20), formed_5pct_of_pop=dict(**both(v5), seeds=k5),
                             final_census_mean=round(statistics.mean(r["r2"]["final_basin_census"].get(b, 0) for r in rs), 1))
        unnamed = [round(r["r2"]["final_basin_census"].get("unnamed", 0) / max(1, r["final_N"]), 3) for r in rs]
        configs.append(dict(preset=preset, cap=cap, kappa=kappa, niches=niches, seeds=n,
                            active_basins=rs[0]["r2"].get("active"), traits_p20=tr, cooccur_legs_horns_plates=co,
                            basins=basins, unnamed_frac_final=unnamed,
                            species_final=[r["timeline"][-1]["species"] if r["timeline"] else 0 for r in rs],
                            stable_seeds=sum(r["stable"] for r in rs), hunter_band_frac=[r["hunter_band_frac"] for r in rs],
                            final_N=[r["final_N"] for r in rs], wall_ms_per_sim_s_numpy=round(statistics.median(r["wall_ms_per_sim_s"] for r in rs), 2),
                            timeline_seed0=[{k: d.get(k) for k in ("t", "N", "grazers", "omni", "hunters", "species", "unnamed", "juvenile", "cooccur", "basin_census", "basin_formed")}
                                            for d in rs[0]["timeline"][::5]]))
    div = {}
    for (cap, kappa, niches) in sorted({(r["cap"], r["r2"]["kappa"], r["r2"]["niches"]) for r in runs}):
        for field in ("final_basin_census", "final_bins"):
            by = defaultdict(list)
            for r in runs:
                if (r["cap"], r["r2"]["kappa"], r["r2"]["niches"]) == (cap, kappa, niches) and r[field] if field == "final_bins" else (r["cap"], r["r2"]["kappa"], r["r2"]["niches"]) == (cap, kappa, niches):
                    by[r["preset"]].append(r[field] if field == "final_bins" else r["r2"][field])
            within = [l1(a, b) for p in by for a, b in itertools.combinations(by[p], 2)]
            between = {f"{p}|{q}": round(statistics.mean(l1(a, b) for a in by[p] for b in by[q]), 2) for p, q in itertools.combinations(sorted(by), 2)}
            div[f"cap{cap}_k{kappa}_niche{niches}:{field}"] = dict(within_mean=round(statistics.mean(within), 2) if within else None,
                                                                   between_mean=round(statistics.mean(between.values()), 2) if between else None, between=between)
    J = json.load(open(out))
    J[block] = dict(about="Hybrid engine: open-ended F + sigma x2.5 always on + round-1 plate/dissolution fix + 7 body basins "
                             "(canalization in develop, kappa on look genes only, top-3 affinity basins active) + niche partitioning "
                             "(ground / liquid / aerial Spark / canopy / stone dens) + notes/02 biology changes. T = 1300 sim-s = demo 150 s "
                             "on the hybrid schedule. demo_hybrid = x1 to 2:00 then x40; demo_x3 = constant x3 from eco start (0:25).",
                       activation=runs[0]["r2"].get("activation"), formed_thresholds=runs[0]["r2"].get("form"),
                       r2_overrides=R["r2_overrides"], basins=R["basins"],
                       new_coefficients={k: R["coefficients"][k] for k in ("k_gas", "k_bigcold", "k_induce")},
                       sweep_wall_s=R["sweep_wall_s"], configs=configs, bestiary_divergence=div)
    json.dump(J, open(out, "w"), indent=1); print(block, len(configs), "configs")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], *(sys.argv[3:4]))
