# Audio: the soundscape

Owner request 2026-11-08 (Caden): sound that makes the app feel alive, somewhat scientific, ambient and colourful, immersive in the way Subnautica is. Audio belongs to the art layer: it **reads** sim state and bus events and never writes either. Feature freeze 10:00, so the demo path comes first.

## Principles

1. **Sound follows the stats, like visuals do.** No lapping waves when the seas are frozen, no seas audio before `build.seasSec`, no birdsong-like calls before `build:life`, creature calls only from creatures that exist (nearest N real organisms in the snapshot), and wind gets louder and lower as air density rises.
2. **Scientific touches, physically derived** (physics constants are exempt from world config):
   - **Speed of sound** c = √(γRT/M) from the live temperature and mean molar mass (γ = 1.4 for diatomic air). Cavity resonances scale with c, so a creature's call formant ∝ c ÷ body length. In silicon's 90 K nitrogen air, c ≈ 190 m/s against 343 m/s on Earth, so the same body sounds lower and darker there. Show this nowhere, but say it if asked.
   - **Body size sets pitch**: call pitch ∝ 1 ÷ length (bigger animals sound lower).
   - **Underwater**: master low-pass (about 500–800 Hz) plus a longer reverb, and a rebreather loop on the player.
   - **Thick air** (silicon, about 13 kg/m³): wind is deeper, slower and more present.
3. **Colourful, not noisy.** Ambient beds carry the world. One-shots are sparse. There is a voice cap (about 24) and a ducking rule: UI and the build sequence duck the ambience by about 6 dB.
4. **Rendering stays deterministic.** Audio never draws from the sim RNG. It uses its own stream or `Math.random`, since audio isn't part of the demo-determinism contract.
5. **Autoplay**: the `AudioContext` is created suspended and resumed on the first user gesture. **M** toggles mute, and a small speaker toggle sits by the Conditions tab.

## Files

- `public/audio/{id}.mp3` (ElevenLabs, generated offline by `scripts/gen-audio.mjs`) or `.ogg` (CC0 downloads)
- `public/audio/manifest.json`: `{ id, file, loop, gain, source: 'elevenlabs' | 'kenney' | ..., licence, prompt? }[]`
- `public/audio/CREDITS.md`: every third-party file with its source URL and licence (CC0 only)
- `src/audio/`: the engine (Web Audio). The cue ids below are the contract between generation and engine.
- **The ElevenLabs key lives only in `.env.local` as `ELEVENLABS_API_KEY` (no `VITE_` prefix, so it is never bundled). It is never committed and never printed.**

## Cue list (ids are the contract)

Loops (`loop: true`, 20–30 s, seamless):

| id | Where and when | Brief |
|---|---|---|
| `amb.select` | Selection screen | Quiet lab room tone, very soft particle fizz, a hopeful airy pad |
| `amb.carbon.land` | Carbon, on land after `build:life` | Warm breeze through foliage, distant alien chirps and trills, insects, lush and calm |
| `amb.carbon.barren` | Carbon, on land before life | Wind over bare rock, faint grit, empty |
| `amb.carbon.shore` | Carbon, near the shoreline (liquid seas) | Gentle waves lapping on rock and sand, soft foam |
| `amb.carbon.under` | Carbon, underwater | Muffled deep water, slow bubbles, a distant whale-like song, Subnautica's Safe Shallows calm |
| `amb.silicon.land` | Silicon, on land | Deep, slow, heavy wind (thick air), glassy crystalline tinkling, faint cryogenic creaks, alien and cold |
| `amb.silicon.shore` | Silicon, near liquid-nitrogen seas | Very cold thin liquid lapping with a soft boiling fizz and hiss (Leidenfrost vapour) |
| `amb.silicon.under` | Silicon, under liquid nitrogen | Crystal-clear cold depth, glassy pings, a low resonant hum, sparse |
| `amb.frozen` | Either world, seas frozen | Ice creaking and groaning, low booming cracks far away |
| `amb.build.rise` | During the build | A 20 s tectonic swell: deep rumble that grows, granular grit, ending in a bright resolve |

One-shots (several variants, `{id}.1`, `{id}.2` …, where marked ×N):

| id | Trigger |
|---|---|
| `ui.hover` ×2, `ui.click` ×2 | Buttons, chips and tabs |
| `ui.element` | Clicking carbon or silicon on the selection screen |
| `ui.slider.tick` | Slider steps (rate-limited) |
| `ui.slider.blocked` | `control:blocked` (soft low thud and buzz) |
| `ui.panel.open`, `ui.panel.close` | Conditions or bestiary drawer |
| `ui.generate` | The Generate button (a big, satisfying ignition) |
| `ui.scan.lock` | Scanner lock on a NEW SPECIES (sonar ping) |
| `ui.scan.filed` | First scan of a kind ("New entry" chime, like Subnautica's databank) |
| `ui.card.open` | Inspect card opens (paper and scanner blip) |
| `ui.extinct` | A kind moves to "Died out" (soft low tone) |
| `build.push` | Camera pushes into the particle box (0–1.5 s whoosh) |
| `build.multiply` | Particles multiplying (1.5–5 s rising shimmer) |
| `build.land` | Particles settle into ground (about 5 s, soft impact and bloom) |
| `build.seas` | Seas begin to fill (rushing water; nitrogen fizz on silicon: `build.seas.silicon`) |
| `build.life` | `build:life` (bioluminescent sparkle bloom) |
| `build.complete` | `build:complete` (warm resolving swell) |
| `step.soil` ×4, `step.rock` ×4, `step.crystal` ×4, `step.ice` ×4, `step.wet` ×4 | Footsteps by surface (mineral and world) |
| `player.jump`, `player.land` | Jump takeoff and landing |
| `player.splash.in`, `player.splash.out` | Entering and leaving the sea |
| `player.swim` ×3 | Swim strokes |
| `player.rebreather` (loop) | Underwater suit breathing |
| `c.call.small` ×3, `c.call.herd` ×3, `c.call.apex` ×2, `c.call.swim` ×3, `c.wing` ×2 | Carbon creatures |
| `si.call.small` ×3, `si.call.bell` ×2, `si.clack` ×3, `si.call.walker` ×2 | Silicon creatures |

Procedural layers (Web Audio, no files): wind (filtered noise; gain and cutoff from air density and the player's speed), the particle-box fizz (granular noise bursts whose rate follows temperature, and which stops when the box freezes), a slider-drag tone, and the underwater filter and reverb send.
