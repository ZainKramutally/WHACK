"""Aggregate raw sweep runs into data/time-to-trait.json (sim-s -> demo-s, bestiary distances)."""
import json, sys, itertools, statistics
from collections import defaultdict

ECO_START = 25.0      # demo second the ecology starts (F §2: worms open their eyes at 0:24)
HYBRID_SWITCH = 120.0  # hybrid timeline: x1 until 2:00, then deep time x40 (emergence README §4.2)


def demo_s(sim_s, speed):
    return None if sim_s is None else round(ECO_START + sim_s / speed, 1)


def demo_hybrid(sim_s):
    if sim_s is None:
        return None
    x1 = HYBRID_SWITCH - ECO_START
    return round(ECO_START + sim_s, 1) if sim_s <= x1 else round(HYBRID_SWITCH + (sim_s - x1) / 40, 1)


def med(vals, nseeds):
    got = [v for v in vals if v is not None]
    if len(got) * 2 <= nseeds:          # reached in at most half the seeds -> not reliably reached
        return None, len(got)
    return round(statistics.median(got + [float("inf")] * (nseeds - len(got))), 1), len(got)


def l1(a, b):
    ka = set(a) | set(b); sa = sum(a.values()) or 1; sb = sum(b.values()) or 1
    return sum(abs(a.get(k, 0) / sa - b.get(k, 0) / sb) for k in ka)


def main(raw, out):
    R = json.load(open(raw))
    groups = defaultdict(list)
    for r in R["runs"]:
        key = (r["mode"], r["preset"], r["cap"], r["mut_mult"], r["dup"], r["cheats"], r["pull"])
        groups[key].append(r)
    configs = []
    for key, rs in sorted(groups.items(), key=lambda kv: str(kv[0])):
        mode, preset, cap, mm, dup, cheats, pull = key
        n = len(rs); traits = {}
        for t in rs[0]["first"]:
            f, fn = med([r["first"][t] for r in rs], n)
            p, pn = med([r["p20"][t] for r in rs], n)
            traits[t] = dict(first_sim_s=f, first_seeds=fn, p20_sim_s=p, p20_seeds=pn,
                             p20_demo_s={"x1": demo_s(p, 1), "x4": demo_s(p, 4), "x40": demo_s(p, 40),
                                         "hybrid_x1_then_x40": demo_hybrid(p)},
                             speedup_needed_for_150_demo_s=None if p is None else round(p / (150 - ECO_START), 2))
        ht, htn = med([r["hunter_tier"] for r in rs], n)
        traits["hunter_tier_5pct"] = dict(p20_sim_s=ht, p20_seeds=htn, p20_demo_s={"x1": demo_s(ht, 1), "x40": demo_s(ht, 40),
                                          "hybrid_x1_then_x40": demo_hybrid(ht)})
        tpl = {}
        for name in rs[0]["tpl_p20"]:
            p, pn = med([r["tpl_p20"][name] for r in rs], n)
            tpl[name] = dict(p20_sim_s=p, p20_seeds=pn, p20_demo_hybrid=demo_hybrid(p),
                             final_census_mean=round(statistics.mean(r["final_tpl_census"][name] for r in rs), 1),
                             final_formed_mean=round(statistics.mean(r["final_formed"][name] for r in rs), 1))
        tl = rs[0]["timeline"]
        configs.append(dict(
            mode=mode, preset=preset, cap=cap, mut_mult=mm, seg_dup=dup, cheats=cheats, pull=pull, seeds=n,
            T_sim_s=rs[0]["T"], ticks_per_sim_s_F=20,
            traits=traits, templates=tpl,
            species_final=[r["timeline"][-1]["species"] if r["timeline"] else 0 for r in rs],
            stable_seeds=sum(r["stable"] for r in rs), extinct_seeds=sum(r["extinct_t"] is not None for r in rs),
            minN_after60=[r["minN_after60"] for r in rs],
            hunter_band_frac=[r["hunter_band_frac"] for r in rs],
            final_gen=[r["final_gen"] for r in rs],
            sim_s_per_generation=round(statistics.median(r["T"] / r["final_gen"] for r in rs if r["final_gen"]), 1)
            if any(r["final_gen"] for r in rs) else None,
            wall_ms_per_sim_s_numpy=round(statistics.median(r["wall_ms_per_sim_s"] for r in rs), 2),
            trophic_timeline_seed0=[dict(t=d["t"], N=d["N"], grazers=d["grazers"], omni=d["omni"], hunters=d["hunters"],
                                         species=d["species"], gen=d["gen"]) for d in tl[:: max(1, len(tl) // 24)]],
        ))
    # bestiary divergence (F §8 assertion: between presets > 0.6, same preset across seeds < 0.4)
    div = {}
    for label, sel in [("open_cap1000_base", lambda r: r["mode"] == "open" and r["cap"] == 1000 and r["mut_mult"] == 1.0 and r["dup"] and not r["cheats"]),
                       ("open_cap1000_mut2.5_cheats", lambda r: r["mode"] == "open" and r["cheats"]),
                       ("guided_cap1000_pull0.25", lambda r: r["mode"] == "guided" and r["cap"] == 1000 and r["pull"] == 0.25),
                       ("guided_cap3000_pull0.25", lambda r: r["mode"] == "guided" and r["cap"] == 3000 and r["pull"] == 0.25)]:
        for field in ("final_bins", "final_tpl_census"):
            by = defaultdict(list)
            for r in R["runs"]:
                if sel(r):
                    by[r["preset"]].append(r[field])
            within = [l1(a, b) for p in by for a, b in itertools.combinations(by[p], 2)]
            between = {f"{p}|{q}": round(statistics.mean(l1(a, b) for a in by[p] for b in by[q]), 2)
                       for p, q in itertools.combinations(sorted(by), 2)}
            div[f"{label}:{field}"] = dict(within_mean=round(statistics.mean(within), 2) if within else None,
                                           between=between,
                                           between_mean=round(statistics.mean(between.values()), 2) if between else None)
    json.dump(dict(
        about="Toy headless F ecology (research/body-plans/prototype/f_ecology.py). Times are medians over seeds; "
              "None = reached in <= half the seeds within T. demo_s = 25 s (eco start) + sim_s/speed. "
              "F's ecology ticks at 20 Hz, so speed xK = 20K ticks per real second.",
        coefficients=R["coefficients"], presets=R["presets"], sea=R["sea"],
        sweep_wall_s=R["sweep_wall_s"], configs=configs, bestiary_divergence=div), open(out, "w"), indent=1)
    print("wrote", out, len(configs), "configs")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
