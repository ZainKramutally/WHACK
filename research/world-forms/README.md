# World forms: how the environment responds to the controls

Question: **how do rock structures, terrain, water, sky and ground change with each control?** The controls are Recipe (C·Si·O), Sea, Heat, Light, Hunger and Time (see `docs/WORLD_ATLAS.md` §5). The aim is a defensible *landform response matrix*, so the world generator (`mockups/worlds`, `docs/features/world-generator.md`) produces geology that is chemically motivated, varied and readable.

1. **Real mechanisms.** What physically builds each landform on the mood board (arches, porous spires, hoodoos, canyons, sea stacks, terraces, towers, dunes, patterned ground), and which variable drives it: solvent, temperature, time, life or light?
2. **Other worlds.** Titan, Venus, Mars, icy moons, lava worlds, plus silica-specific and life-built rock (sinter, opal, chert, diatomite, stromatolites, glass-sponge reefs, chemical gardens).
3. **Procedural methods.** How to generate each one live on three.js r187 WebGPU, and what the generator already does.

Evidence tags and status labels follow `research/silicon-life/README.md`.
