# Executive summary: what if life was silicon-based?

Full report: [`REPORT.md`](REPORT.md) · visual: [`report.html`](report.html) · tags/labels: [`README.md`](README.md)

## The answer

Silicon-*backboned* life is almost certainly unworkable. The one systematic review finds that "in no environment is a life based primarily around silicon chemistry a plausible option" (Petkowski, Bains & Seager 2020, doi:10.3390/life10060084) `[REVIEW]` **consensus**. The best "it could work if…" case is a carbon–silicon hybrid in concentrated sulfuric acid, as in Venus's clouds. There, silicon bonds last hours to days instead of an instant **plausible/theorised**.

## Findings

1. **consensus.** Si–Si (222 kJ/mol) is weaker than C–C (346), but Si–O (452) beats C–O (358), so oxygen wins.
2. **consensus.** Si is δ+ (EN 1.90 vs 2.55), so water hydrolyses nearly every Si bond. Si–C is the stable exception.
3. **consensus.** The waste is rock: SiO₂ is a solid. Making SiH₄ from silica costs +434 kJ/mol, while making CH₄ from CO₂ releases 142.
4. **plausible/theorised, disfavoured.** Titan and Triton solvents spare silicon's bonds, but they dissolve almost nothing and react about 10⁻¹⁹× slower.
5. **consensus.** Earth uses silicon only as glass, and a lab-evolved enzyme makes Si–C bonds (Kan 2016).

## Build implications

1. **Rules.** `data/rules.json` covers 12 elements × 5 worlds. Knobs:
   - backbone (C↔Si↔Ge)
   - valence
   - oxygen hunger
   - solvent
   - temperature
   - energy

   Abundance is a preset, not a knob.
2. **Tuning** (prototype). The real orderings are right, but the real magnitudes only ever produce a frozen blob or dead monomers. Fixes:
   - E/kT ≈ 3.5–4.5 per backbone
   - Si water attack ×0.03
   - H:X ≈ 2
   - log-compressed rates for Titan
   - acid attack on C ÷10
3. **GPU bonding.** TSL r187 has no compare-exchange. Use atomicAdd bucket binning, single-writer bond rows, mutual-best proposals, and a symmetric hash roll for breaking.
4. **Emergence.** Use the L0–L4 hybrid. Seed the spark, promote clusters to organisms on chemoton criteria, and target milestones from first bond at 0:05 to three trophic levels at 2:45. The arc: silicon in water stalls, the player swaps the solvent, and silicon life appears.
5. **Differentiation.** In Tidemote, life starts from seeded genomes and players only observe. Ours lets the player author the periodic table, life must be chemically possible, and carbon and silicon run as an A/B.

## Hook lines (verified, notes/04)

1. "The ground under your feet is 28% silicon and 0.02% carbon. You are 18% carbon. Life picked carbon anyway. Today, you get to pick differently."
2. "In 1967 Captain Kirk met a living rock and nearly killed it, because he assumed life had to look like him."
3. "Fifty kilometres above Venus the clouds are sulfuric acid, and a 2020 study found silicon chemistry does better there than in water."

**Off-limits:**
- the Wells quote
- Reynolds 1893
- Asimov's "six"
- "almost certainly impossible" as a quote
- Arnold's Nobel (not re-checked)
- any "1,400 to 1" ratio (sources give 75–1,400×)

## Risks

1. The tuning comes from a well-mixed toy model, so the spatial GPU sim may still freeze or fall apart. Build the sweet-spot monitors first.
2. Replicators won't emerge in 3 minutes on their own. We seed them and say so.
3. The orderings are cited, but the solvent-attack scores are `[INFERRED]` game values. Say so.
4. Tidemote sets a high polish bar. Lead with editing the laws, not with the ecosystem.
