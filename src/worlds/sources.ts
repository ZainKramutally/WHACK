// Citation list, referenced by id from every config. Only sources whose DOI was resolved are listed here
// (silicon-life REPORT.md §10 resolved 2026-11-07; the four marked "Crossref" were resolved against Crossref
// by title and first author while writing this file). Anything unverified is `assumption: true` in the
// config instead, never a made-up citation. Every entry was re-checked against Crossref (or NIST) on 2026-11-07;
// the per-source status and the claims each supports are in research/sources-verified.md (issues #9, #26).

export interface Source {
  id: string;
  citation: string;   // short human-readable reference
  doi?: string;
  url?: string;       // for sources without a DOI (databases)
  note?: string;      // what we use it for
}

const list: Source[] = [
  {
    id: 'bains2004',
    citation: 'Bains W (2004). Many chemistries could be used to build living systems. Astrobiology.',
    doi: '10.1089/153110704323175124',
    note: 'Liquid nitrogen and other solvents as candidates for life.',
  },
  {
    id: 'petkowski2020',
    citation: 'Petkowski JJ, Bains W, Seager S (2020). On the potential of silicon as a building block for life. Life 10:84.',
    doi: '10.3390/life10060084',
    note: 'Si bond energies (Table 1), silicon chemistry in cryosolvents (Appendix C), solubility limits in liquid nitrogen, and the verdict that no environment makes silicon life plausible.',
  },
  {
    id: 'nrc2007',
    citation: 'National Research Council (2007). The Limits of Organic Life in Planetary Systems.',
    doi: '10.17226/11919',
    note: 'Non-water solvents and cold chemistry.',
  },
  {
    id: 'kan2016',
    citation: 'Kan SBJ, Lewis RD, Chen K, Arnold FH (2016). Directed evolution of cytochrome c for carbon–silicon bond formation. Science.',
    doi: '10.1126/science.aah6219',
    note: 'Real-world aside: biology can be made to form Si–C bonds, with a synthetic silane substrate.',
  },
  {
    id: 'pace2001',
    citation: 'Pace NR (2001). The universal nature of biochemistry. PNAS 98:805.',
    doi: '10.1073/pnas.98.3.805',
    note: 'The case for carbon in water as the likely universal biochemistry.',
  },
  {
    id: 'takai2008',
    citation: 'Takai K et al. (2008). Cell proliferation at 122 °C and isotopically heavy CH4 production by a hyperthermophilic methanogen under high-pressure cultivation. PNAS.',
    doi: '10.1073/pnas.0712334105',
    note: 'Crossref. Highest temperature at which any known organism grows (carbon upper limit).',
  },
  {
    id: 'hoffman2017',
    citation: 'Hoffman PF et al. (2017). Snowball Earth climate dynamics and Cryogenian geology-geobiology. Science Advances.',
    doi: '10.1126/sciadv.1600983',
    note: 'Crossref. Surface life survived Snowball Earth conditions (carbon cold bound).',
  },
  {
    id: 'goldblatt2009',
    citation: 'Goldblatt C et al. (2009). Nitrogen-enhanced greenhouse warming on early Earth. Nature Geoscience.',
    doi: '10.1038/ngeo692',
    note: 'Crossref. More nitrogen warms the planet a little through the CO2 greenhouse.',
  },
  {
    id: 'lee1995',
    citation: 'Lee MR, Russell SS, Arden JW, Pillinger CT (1995). Nierite (Si3N4), a new mineral from ordinary and enstatite chondrites. Meteoritics 30:387.',
    doi: '10.1111/j.1945-5100.1995.tb01142.x',
    note: 'Crossref. Silicon nitride occurs naturally in reduced (enstatite) chondrites: a plausible feedstock on a reduced, oxygen-free world.',
  },
  {
    id: 'myhre1998',
    citation: 'Myhre G, Highwood EJ, Shine KP, Stordal F (1998). New estimates of radiative forcing due to well mixed greenhouse gases. Geophysical Research Letters 25:2715.',
    doi: '10.1029/98GL01908',
    note: 'Crossref. CO2 forcing grows with the logarithm of concentration: a fixed warming per doubling.',
  },
  {
    id: 'sherwood2020',
    citation: "Sherwood SC et al. (2020). An assessment of Earth's climate sensitivity using multiple lines of evidence. Reviews of Geophysics 58:e2019RG000678.",
    doi: '10.1029/2019RG000678',
    note: 'Crossref. Best estimate of the warming per CO2 doubling (about 2.6 to 3.9 K likely range, central 3.1 K).',
  },
  {
    id: 'som2016',
    citation: "Som SM et al. (2016). Earth's air pressure 2.7 billion years ago constrained to less than half of modern levels. Nature Geoscience.",
    doi: '10.1038/ngeo2713',
    note: 'Crossref. Early Earth life thrived on much less air than today.',
  },
  {
    id: 'fulchignoni2005',
    citation: "Fulchignoni M et al. (2005). In situ measurements of the physical characteristics of Titan's environment. Nature.",
    doi: '10.1038/nature04314',
    note: "Crossref. Huygens measured Titan's surface at about 94 K and about 1.5 bar of nitrogen: the real thick cold air our silicon world is modelled on.",
  },
  {
    id: 'mastrogiuseppe2014',
    citation: 'Mastrogiuseppe M et al. (2014). The bathymetry of a Titan sea. Geophysical Research Letters.',
    doi: '10.1002/2013GL058618',
    note: 'Crossref. Cassini radar found Ligeia Mare at least about 160 m deep: the real scale of a cold-world sea.',
  },
  {
    id: 'nistN2',
    citation: 'Linstrom PJ, Mallard WG (eds). NIST Chemistry WebBook, NIST Standard Reference Database 69: nitrogen (CAS 7727-37-9), fluid saturation properties and phase-change data. Retrieved 2026-11-07.',
    url: 'https://webbook.nist.gov/cgi/fluid.cgi?ID=C7727379&Action=Page',
    note: 'N₂ vapour pressure and liquid density, −210 to −147 °C; triple point 63.14 K / 0.1252 bar and critical point 126.2 K / 33.96 bar. The WebBook has no solid-phase density.',
  },
  {
    id: 'nistH2O',
    citation: 'Linstrom PJ, Mallard WG (eds). NIST Chemistry WebBook, NIST Standard Reference Database 69: water (CAS 7732-18-5), fluid saturation properties. Retrieved 2026-11-07.',
    url: 'https://webbook.nist.gov/cgi/fluid.cgi?ID=C7732185&Action=Page',
    note: 'Water vapour pressure, 10 to 374 °C (the config table matches within 0.3%; the 100 °C entry is 1 atm). Below 0 °C the table is ice sublimation, not checked.',
  },
  {
    id: 'edejer1967',
    citation: 'Edejer MP, Thodos G (1967). Vapor pressures of liquid nitrogen between the triple and critical points. J Chem Eng Data 12:206.',
    doi: '10.1021/je60033a014',
    note: 'Crossref. Independent measured vapour pressures that the NIST table cites for the same range.',
  },
  {
    id: 'stofan2007',
    citation: 'Stofan ER et al. (2007). The lakes of Titan. Nature 445:61.',
    doi: '10.1038/nature05438',
    note: 'Crossref. Titan has surface lakes of liquid hydrocarbons (methane and ethane), not nitrogen.',
  },
  {
    id: 'berner1989',
    citation: 'Berner RA, Canfield DE (1989). A new model for atmospheric oxygen over Phanerozoic time. American Journal of Science 289:333.',
    doi: '10.2475/ajs.289.4.333',
    note: 'Crossref. Atmospheric oxygen tracks the burial of organic carbon (and pyrite) in sediments, not simply the amount of life.',
  },
  {
    id: 'burgess1996',
    citation: 'Burgess BK, Lowe DJ (1996). Mechanism of molybdenum nitrogenase. Chemical Reviews 96:2983.',
    doi: '10.1021/cr950055x',
    note: 'Crossref. Nitrogenase spends about 16 ATP per N₂ fixed (the upkeep cost of body nitrogen).',
  },
  {
    id: 'jassby1976',
    citation: 'Jassby AD, Platt T (1976). Mathematical formulation of the relationship between photosynthesis and light for phytoplankton. Limnology and Oceanography 21:540.',
    doi: '10.4319/lo.1976.21.4.0540',
    note: 'Crossref. Saturating photosynthesis–light curves (producer light response).',
  },
  {
    id: 'manske2005',
    citation: 'Manske AK, Glaeser J, Kuypers MMM, Overmann J (2005). Physiology and phylogeny of green sulfur bacteria forming a monospecific phototrophic assemblage at a depth of 100 meters in the Black Sea. Applied and Environmental Microbiology 71:8049.',
    doi: '10.1128/AEM.71.12.8049-8060.2005',
    note: 'Crossref. Phototrophs living on a tiny fraction of surface light.',
  },
  {
    id: 'huffaker1958',
    citation: 'Huffaker CB (1958). Experimental studies on predation: dispersion factors and predator-prey oscillations. Hilgardia 27:343.',
    doi: '10.3733/hilg.v27n14p343',
    note: 'Crossref. Predator–prey oscillations in a lab ecology.',
  },
  {
    id: 'bell1936',
    citation: 'Bell RP (1936). The theory of reactions involving proton transfers. Proc R Soc Lond A 154:414.',
    doi: '10.1098/rspa.1936.0060',
    note: 'Crossref. Bell–Evans–Polanyi principle (with evans1938): within one reaction family, weaker bonds mean lower barriers.',
  },
  {
    id: 'evans1938',
    citation: 'Evans MG, Polanyi M (1938). Inertia and driving force of chemical reactions. Trans Faraday Soc 34:11.',
    doi: '10.1039/tf9383400011',
    note: 'Crossref. Bell–Evans–Polanyi principle.',
  },
  {
    id: 'scott1976',
    citation: 'Scott TA (1976). Solid and liquid nitrogen. Physics Reports 27:89.',
    doi: '10.1016/0370-1573(76)90032-6',
    note: 'Crossref (existence only; figures not read). Standard review of solid and liquid N₂ properties, including that the solid is denser than the liquid.',
  },
];

export const sources: Record<string, Source> = Object.fromEntries(list.map((s) => [s.id, s]));

/** Look up a source by id. Throws on an unknown id so a typo in a config fails loudly. */
export function sourceFor(id: string): Source {
  const s = sources[id];
  if (!s) throw new Error(`Unknown source id: ${id}`);
  return s;
}
