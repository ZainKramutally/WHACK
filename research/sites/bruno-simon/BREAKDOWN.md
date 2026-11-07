# Bruno Simon portfolio (folio-2025) - teardown for New Worlds

Live: https://bruno-simon.com/ | Source: https://github.com/brunosimon/folio-2025 (shallow clone read at `/tmp/whack-src/bruno-simon`, nothing installed or run)
Licence: code is MIT, (c) 2025 Bruno Simon (`license.md:1-3`). SOURCE. Asset licence is NOT stated for models/textures/sounds (only `static/sounds/musics/license.md` is CC0). Treat assets as all-rights-reserved: **borrow techniques, never files**.

Evidence tags: **SOURCE** = read in the repo (path:line). **PARTIAL** = names/structure seen, not fully traced. **GUESS** = inference, needs proof before copying. Line numbers refer to the cloned HEAD.

Live recon (Playwright, headless Chromium, `--enable-unsafe-webgpu`): `navigator.gpu` was present, 1 `<canvas>`, WebGPU path rendered fine headless on this Mac. Screenshots in `RECON/screenshots/`: `01-load-0.png` (ring loader), `01-load-2.png` (revealed landing + "click to start"), `02-after-click.png`, `03-driving.png` (3D title letters, toast "Server connected"). The console also shows an ASCII-art banner (`sources/index.js:5-8`, SOURCE) and `link rel=preload` warnings for `palette.ktx`, `stars.ktx`, `respawnsReferences-compressed.glb`, `intro/sound.ktx` (live, SOURCE-by-observation).

---

## 1. Summary: what it is and why it works as a "world"

A one-person portfolio disguised as a toy-box driving game. You steer a chunky off-road truck around a diorama-scale island (about 190 x 190 units terrain, `Terrain.js:12-13`) where each "area" (projects, lab, career, social, achievements, circuit race, bowling, cookie clicker, toilet, time machine...) is a physical place you drive into, and the CV content lives on in-world signs, billboards and modals. It works as a world because of five things stacked:

1. **A verb from second zero.** Throttle/steer/boost/jump suspension is the whole input vocabulary. There is no menu to read first (`Reveal.js:139-145`).
2. **Everything is physical.** Crates, bricks, benches, lanterns and fences are Rapier bodies you can smash and that reset on respawn (`Objects.js:229-280`). Hitting stuff is fun and teaches the physics.
3. **The world has a clock and a calendar.** A 4-minute day cycle (`DayCycles.js:16`) and a real-calendar year cycle (`YearCycles.js:8`) drive light, fog, foliage, weather and ambient audio. Our screenshot (Nov 7) shows full autumn red/orange; that is data, not an art choice.
4. **One strict art system.** Flat palette-textured meshes + a custom light/shadow/fog/bounce shader + bloom + tilt-shift DOF. Everything reads as one object (see Style DNA).
5. **Other humans leave traces.** Whispers (messages in the world), a circuit leaderboard, a server-triggered tornado, achievements with localStorage (`Whispers.js:309`, `CircuitArea.js:1290`, `Tornado.js:121`).

---

## 2. Architecture

**Entry.** `sources/index.js:1-13` imports `threejs-override.js`, then does `new Game()` (exposes `window.game` only if `VITE_GAME_PUBLIC`). SOURCE.

**Pattern.** One `Game` singleton (`Game.js:54-68`, `Game.getInstance()`); every module is a class that calls `Game.getInstance()` in its constructor and reads siblings off `this.game.*`. No DI, no ECS, no state library. SOURCE.

**Boot order** (`Game.js:70-216`), SOURCE:
1. Core classes: `Debug, ResourcesLoader, Quality, Server, Ticker, Time, DayCycles, YearCycles, Inputs([], ['intro']), Audio, Notifications, RayCursor, Viewport, Modals, Menu, Rendering` (`:79-94`).
2. `await rendering.setRenderer()` (WebGPU init, `:95`).
3. Load a **small first batch**: respawn references glb, stars tex, sound-icon tex, **palette tex** (`:103-109`). Only then `Options, Respawns, View, setPostprocessing, rendering.start(), Reveal, Noises, Weather, Wind, Tracks, Lighting, Fog, Water, Materials, Objects, Explosions, World` (`:110-126`). `World` ctor runs `step(0)` = only `Grid + Intro` (`World.js:38,47-53`).
4. Kick off Rapier as a dynamic `import('@dimforge/rapier3d')` (`:129`) in parallel with the big resource batch (~35 glb/ktx files, `:132-179`). The load progress callback feeds the intro ring: `world.intro.updateProgress(1 - toLoad/total)` (`:175-178`).
5. `Promise.all([resources, rapier])` (`:181`), then `Terrain, Physics, PhysicsWireframe, PhysicsVehicle, Zones, Player, ClosingManager, InteractivePoints, KonamiCode, Achievements, Tornado, Map, Title`, `world.step(1)` (builds visual vehicle, floor, water, grass, trees, areas...) and `Overlay` (`:185-200`).
6. If `quality.level === 0` and backend is WebGPU: `PreRenderer.render()` renders everything once into a 32px cube target with all invisible objects forced visible, to pre-compile pipelines and avoid first-use hitches (`:203-204`, `PreRenderer.js:5-33`).
7. After 3 frames: `reveal.updateStep(0)` (`:206-209`). Step 1 (click) and step 2 (`world.step(2)` creates Whispers, starts the Server) come later (`Reveal.js:149-227`).

**Event system.** Tiny `Events` class where `on(name, cb, order=1)` stores callbacks bucketed by numeric order and `trigger` iterates buckets in ascending order (`Events.js:8-62`). The ticker's `'tick'` event uses `order` as the **system update priority**. This one trick replaces a scheduler. SOURCE.

**Game loop.** `renderer.setAnimationLoop(t => ticker.update(t))` (`Rendering.js:68`). `Ticker.update` clamps `delta` to `1/30`, multiplies by `scale = 2` for game-time (`Ticker.js:15,29-34`), updates TSL `uniform`s for elapsed/delta (`:47-50`), runs frame-count `wait()` callbacks (`:52-63`), then `events.trigger('tick')` (`:65`). Order below is the readme (`readme.md` "Game loop") and matches the `on('tick', fn, N)` calls I grepped. SOURCE:

| order | systems |
|---|---|
| 0 | Time (`Time.js:19-22`), Inputs (`Inputs.js:~`) |
| 1 | Player pre-physics |
| 2 | PhysicsVehicle pre-physics (`PhysicsVehicle.js:77-80`) |
| 3 | Physics step (`Physics.js:60-63`) |
| 4 | PhysicsWireframe, Objects sync (`Objects.js:15-18`) |
| 5 | PhysicsVehicle post-physics (`:81-84`) |
| 6 | Player post-physics |
| 7 | View/camera (`View.js:~`, on tick 7) |
| 8 | Intro, DayCycles, YearCycles, Weather, Zones, VisualVehicle (`Cycles.js:59-62`, `Intro.js:20`) |
| 9 | Wind, Lighting (`Ligthing.js:43-46`), Tornado, InteractivePoints, Tracks |
| 10 | Area++, Foliage, Fog (`Fog.js:25-28`), Reveal, Terrain, Trails, Floor, Grass, Leaves, Lightnings, Rain, Snow, Water, Benches, Bricks, ... |
| 13 | InstancedGroup (`InstancedGroup.js:19-22`) |
| 14 | Audio (`Audio.js:~`), Notifications, Title |
| 998 | Rendering (`Rendering.js:27-30`) |
| 999 | Monitoring |

Sequencing rule: inputs -> pre-physics -> physics -> post-physics read-back -> camera -> world visuals driven by cycles -> instance matrix upload -> audio -> render. Camera runs **after** physics so it never lags a frame behind the truck.

**Time scaling.** `Time` sets `ticker.scale` AND `gsap.globalTimeline.timeScale` together (`Time.js:74-79`) and has a "bullet time" ramp (`:36-72`, scale 2 -> 0.5). Audio playback rate follows the same ratio (`Audio.js:714` `globalRate`). One knob slows physics, tweens, shaders and sound together. SOURCE.

---

## 3. Rendering pipeline

### 3.1 Renderer setup (SOURCE `Rendering.js:38-72`)
```js
this.renderer = new THREE.WebGPURenderer({ canvas, powerPreference: 'high-performance',
    forceWebGL: false, antialias: pixelRatio < 2 })           // :40-45
this.renderer.sortObjects = false                              // :48
this.renderer.shadowMap.enabled = true                         // :51
this.renderer.setOpaqueSort((a,b)=>a.renderOrder-b.renderOrder) // :53-60 manual draw order only
this.renderer.setAnimationLoop(t => this.game.ticker.update(t)) // :68
return this.renderer.init()                                    // :70-71 (awaited in Game.js:95)
```
Imports are `three/webgpu` + `three/tsl` everywhere (`Rendering.js:1-2`). `forceWebGL:false` still lets three fall back to its WebGL2 backend; `Game.js:203` checks `renderer.backend.isWebGPUBackend`. `#inspector` in the URL hash enables three's Inspector (`:62-65`); `#stats` shows draw calls/triangles (`:133-163`). Both are free debugging tools worth copying.

### 3.2 Post-processing (SOURCE `Rendering.js:74-104`, `Passes/cheapDOF.js`)
Uses the new `THREE.RenderPipeline` (not the old `PostProcessing` name):
```js
const scenePass = pass(scene, camera)
const scenePassColor = scenePass.getTextureNode('output')
this.bloomPass = bloom(scenePassColor)                 // three/addons/tsl/display/BloomNode.js
this.bloomPass._nMips = quality.level === 0 ? 5 : 2    // :82
this.bloomPass.threshold.value = 1                     // :83  only HDR (>1) pixels bloom
this.bloomPass.strength.value = 0.25                   // :84
this.cheapDOFPass = cheapDOF(renderOutput(scenePass))
// level 0: outputNode = cheapDOFPass.add(bloomPass); level 1: scenePassColor.add(bloomPass)  (:92-99)
```
The trick: **bloom threshold is 1.0 and "emissive" materials output colour > 1**, so only deliberately bright things glow (see 3.3).

`cheapDOF.js` is a ~50 line custom TSL `Node` (SOURCE `:5-53`): a fake tilt-shift. Blur strength = `smoothstep(start=0.2, end=0.5, |uv.y - 0.5|)` (`:31`), blur = `hashBlur(texture, strength*amount(0.003), {repeats:25})` (`:35`), result = `mix(sharp, blur, strength)` (`:48`). It blurs the top and bottom of the screen and keeps a horizontal band sharp, which sells the miniature/diorama look for almost nothing. Dropped on mobile quality.

### 3.3 Materials (the core of the look)

**One custom material for the whole world.** `MeshDefaultMaterial extends THREE.MeshLambertNodeMaterial` (`Materials/MeshDefaultMaterial.js:5`). It replaces three's lighting entirely with a hand-built `outputNode` (`:67-134`). Steps (all SOURCE):
- **Base colour** from `colorNode` (palette texture sample, gradient, or glTF map).
- **Light bounce / ambient from terrain** (`:81-89`): downward-facing normals pick up the *terrain colour beneath them* via `terrain.terrainNode(positionWorld.xz)` -> `terrain.colorNode(...)`, attenuated by height^2. Fake GI that ties props to the ground colour.
- **Water tint** (`:91-97`): near the water surface height the colour is forced white.
- **Light** (`:99-100`): `outputColor *= lighting.colorUniform * lighting.intensityUniform` (day-cycle-driven, not three's lights).
- **Core shadow** (`:102-105`): `smoothstep(coreShadowEdgeHigh, coreShadowEdgeLow, dot(normal, lightDir))` = cel-ish terminator.
- **Cast shadow capture** (`:49-62`): a `receivedShadowNode` hook *swallows* three's real shadow-map result into a `catchedShadow` float and returns 1 so the stock lighting is neutralised. Shadow is then used as a mask.
- **Shadow colour** (`:112-119`): `mix(lit, baseColor * shadowColor, mask)`. Shadows are **tinted violet/blue (`shadowColor` from day cycle), not darkened**.
- **Fog** (`:121-123`): `fog.strength.mix(color, fog.color)`.
- **Alpha-test discard** (`:125-126`) then **reveal** (`:128-130`).

**Reveal as a shader feature** (`:7-19`, SOURCE): every material discards fragments with `distance(positionWorld.xz, reveal.position) > reveal.distance` and paints a thin glowing rim (`thickness 0.05`, `color*intensity`) at the edge. Animating one uniform (`Reveal.js:62-70`) uncovers the entire world as an expanding circle. This is the intro's centrepiece and is ~10 lines of TSL.

**Palette texture.** `Materials.js:36-44`: `new MeshDefaultMaterial({ colorNode: texture(paletteTexture).rgb })`. The palette is a 128 x 4 PNG (I decoded it locally for analysis only: 34 distinct colours, ~16 px swatches). Meshes are UV-mapped in Blender onto swatches; texture is `NearestFilter`, no mipmaps, sRGB (`Game.js:107`). So every prop is flat colour with zero texture memory and perfect palette discipline. readme: "Mute the palette texture node [in Blender] (loaded and set in Three.js Material directly)" (`readme.md` Blender > Export). Unknown glTF materials are auto-converted by name via `Materials.getFromName / createFromMaterial` (`:273-343`).

**Emissive materials** (`Materials.js:113-178`, SOURCE): `colorNode = baseColor / luminance(baseColor) * intensity` - normalising luminance to 1 then multiplying by 1.5-2.7 so *every hue* glows at equal strength, with `material.fog = false`. Five radial-gradient emissives defined (`:27-31`): orange `#ff8641->#ff3e00`, purple `#454bbc->#ff2eb4`, blue `#91f0ff->#128fff`, green `#f8ffa6->#74ff00`, white. These are lanterns, truck lights, reveal rim, neon.

**Foliage = SDF-alpha clumps** (SOURCE, `World/Foliage.js:~28-170`): geometry is 80 randomly oriented 0.8 quads scattered inside a unit sphere (power-biased towards the rim), with normals lerped 0.85 toward the radial direction so each clump shades as a sphere. Alpha comes from a single-channel `foliageSDF` texture, rotated by wind (`rotateUV` with `wind.offsetNode`), thresholded to get crisp stipple-edged leaves. Optional **see-through near the vehicle in screen space** (`screenUV` distance fade, `:~100-130`) so the truck is never hidden. Trees are instanced meshes with this material. This is the "fuzzy confetti tree" look visible in the screenshots.

**Grass.** `World/Grass.js:12-15`: `subdivisions = 280` -> 78,400 blades in a grid sized to the camera's `optimalArea.radius` (not world-sized), re-built on viewport change (`:34-49`). Blade width/height scale with area (`surfaceOverflow`). PARTIAL on the wind/colour shader.

### 3.4 Lighting (SOURCE `Ligthing.js`)
- Single `DirectionalLight(0xffffff, 5)` casting shadows (`:110-112`); it only exists to produce the shadow map. Shading uses `directionUniform` instead (`:19`).
- Shadow camera is an ortho box of `optimalArea.radius` that **follows the camera focus** (`:153-166, 199-204`), map `2048` on high / `512` on low (`:23, 170`), radius 3 (soft), bias -0.001, normalBias 0.1 (`:26-28`).
- Sun path from day progress: `theta = 0.72 + sin(-(p + 9/16) * 2pi) * 1.25`, `phi = 0.63 + cos(...) * 0.5 * 0.62` (`:185-187`). Light colour/intensity/shadow colour read from day cycle (`:212-213`, `:88`).

### 3.5 Fog and background (SOURCE `Fog.js`)
- `scene.backgroundNode = mix(colorA, colorB, length(viewportUV - center).smoothstep(start, end))` - a **radial vignette gradient as sky** (`:16-18`).
- `fog.strength = rangeFogFactor(near, far)` (`:22`); near/far are *ratios of the camera's visible depth range* (`optimalArea.nearDistance/farDistance`), animated by day cycle (`:44-48`). Fog is applied inside the custom material, not via `scene.fog`.

### 3.6 Terrain (SOURCE `Terrain.js`)
The terrain mesh is a baked glb, but **colour is computed from a data texture**: `terrain.png` channels are read by `terrainNode` (`:93-106`) - `.g` = grass mask, `.b` = height/water-depth lookup into a 1x16 canvas gradient texture (`#ffa94e` 0.1 -> `#5bc2b9` 0.3 -> `#13375f` 0.9, `:45-49`). Final colour = `mix(gradient(b), grassColor #b8b62e, g)` (`:108-117`). **Wheel tracks** subtract from `.g`: a 512px ortho top-down render target (`Tracks.js:~10-30`, 40-unit window) is sampled in `terrainNode` (`:99-103`) so the truck flattens grass. Same `terrainNode` feeds the light-bounce in every material. Elegant: one data texture drives ground colour, grass density, bounce light and tracks.

### 3.7 Day / year / weather (SOURCE)
- `Cycles` base class: `absoluteProgress = Date.now()/1000/duration` (`Cycles.js:23`) so **it follows the visitor's real wall clock**, keyframes of colour/number props interpolated by `stop` (`:66-141`), plus punctual and interval events (`:154-195`) for "night", "deepNight" triggers.
- `DayCycles`: 240 s loop (`DayCycles.js:16`); presets day/dusk/night/dawn each with revealColor, lightColor/Intensity, shadowColor, fogColorA/B, fogNear/Far, temperature, electricField (`:4-9`); stops 0 day, .15 day, .25 dusk, .35 night, .6 night, .8 dawn, .9 day (`:52-60`).
- `YearCycles`: 365-day loop (`YearCycles.js:8`), seasons set `leaves` (fall = 1), temperature, humidity, clouds, wind (`:13-26`).
- `Weather` derives rain/snow/temperature from the cycles plus noise (`Weather.js:20-40, 104-124`). Rain lines, snow, lightning, leaves, tornado are separate instanced/line meshes (`World.js:60-67`).

### 3.8 Other visual features worth knowing (PARTIAL: files read at header level)
Speed lines when boosting (`View.js:462`, `setSpeedLines`), camera roll kick (`View.js:358-390`), water surface with ice (`WaterSurface.js`, `PhysicsVehicle.js:495-501` lowers wheel friction on ice), trails, confetti, explosions, whispers (flame sprites + messages), 3D extruded title text (`Title.js`; visible in `03-driving.png`).

---

## 4. Physics and vehicle

**World** (SOURCE `Physics/Physics.js`):
- Rapier `World({x:0,y:-9.81,z:0})` (`:10-11`), imported as WASM through `vite-plugin-wasm` (`vite.config.js:3,22`).
- **Variable timestep**: `world.timestep = ticker.deltaScaled` each frame, then `world.step(eventQueue)` (`:243, 263`). Not a fixed-step accumulator. Delta is clamped to 1/30 first (`Ticker.js:32`), and the vehicle controller uses `min(1/60, deltaAverage)` (`PhysicsVehicle.js:511-512`, low quality fixed at 1/60). Simple, works, not deterministic.
- Collision groups bitmask: `all`, `object`, `bumper` (`:31-40`) so the truck's invisible bumper collider only hits dynamic objects.
- Water: bodies in water get damping 1 (`:247-259`).
- Collision audio/FX: `CONTACT_FORCE_EVENTS` with a threshold; `drainContactForceEvents` calls `physical.onCollision(force, position)` where force = maxForce / (m1+m2) (`:215-223, 282-313`).

**Collider authoring from Blender names** (SOURCE `Objects.js:116-221`, the most reusable idea). A glb node whose name matches `/physical/i` becomes a body; `fixed|dynamic|kinematicPositionBased` in the name picks type (default fixed, `:125-136`); **children are colliders by name prefix**: `trimesh*`, `hull*`, `cuboid*` (half-extents = child scale/2), `tube*` (cylinder), `ball*` (`:165-193`). Friction/restitution/category come from Blender custom properties -> `userData` (`:139-149, 195-203`). Child meshes are removed after harvesting (`:211`). Artist places primitives in Blender, no code per prop. Visual and physics are separate glbs (`playgroundVisual` / `playgroundPhysical`, `Game.js:137-138`).

**Objects registry** (`Objects.js:21-114`): `add(visualDesc, physicalDesc)` links `body.userData.object` <-> `object3D.userData.object`; sync body -> mesh each tick at order 4; `resetAll()` disables the body, restores `initialState`, re-enables next frame (`:229-280`). `Game.reset()` also resets bowling, crates, instanced groups (`Game.js:218-274`).

**Vehicle** (SOURCE `Physics/PhysicsVehicle.js`): not a hand-rolled spring model - it uses **Rapier's built-in raycast vehicle**: `physics.world.createVehicleController(chassisBody)` (`:69`), 4 wheels via `controller.addWheel(...)` and per-wheel setters (`:131, 154-183`), `controller.updateVehicle(delta)` each frame (`:512`).
- Chassis: dynamic body, friction 0.4, **low centre of mass** (`y:-0.5` offset), 3 cuboids, `canSleep:false` (`:90-106`).
- Tuning: steering 0.5 rad, engine 300, boost x2, topSpeed 5 -> 40 boosting, brake 35, idle brake 0.06, reverse brake 0.4 (`:14-21`). Wheel: radius 0.4, frictionSlip 0.9, suspension stiffness 25, compression 10, relaxation 2.7, max travel 2, side friction stiffness 3 (`:140-152`).
- Engine force falls off beyond top speed: `/(1 + overflowSpeed...)` (`:462`). Braking auto-applies when the player reverses direction (`:470-480`).
- **Jump = suspension trick**: per-wheel rest length/stiffness switch among low/mid/high (`:31-40, 493-494`); holding Space sets all four to `high` for a hop, numpad/1-4 keys raise individual corners (lowrider hydraulics) (`Player.js:218-300`). Extra `flip.jump()` impulse + torque for self-righting (`:404-438`).
- Detectors that emit events: `stop/start` (speed hysteresis 0.04/0.7), `upsideDown` (up.dot(-Y)), `stuck` (<0.5 m in 3 s while throttling), `flip` (accumulated Z rotation > 5 rad in air) (`:203-402`, called each post-physics `:577-580`). These events feed achievements, auto-respawn prompts, sounds. Cheap and very reusable.
- Visual wheels/body are a separate `VisualVehicle` driven by `wheel.suspensionLength` / contact point read back after physics (`:550-560`; visual file PARTIAL).

---

## 5. Inputs, controls, camera

**Input layer** (SOURCE `Inputs/Inputs.js`): named **actions** with `categories` and `keys`, e.g. `{ name:'forward', categories:['wandering','racing','cinematic'], keys:['Keyboard.ArrowUp','Keyboard.KeyW','Gamepad.up','Gamepad.r2'] }` (`Player.js:218-237`). Sources: Keyboard, Gamepad (typed xbox/playstation), Pointer, Wheel, InteractiveButtons, **Nipple** touch joystick (`Inputs.js:63-170`). `Inputs.mode` flips between mouse+keyboard / gamepad / touch on the last-used device (`:302-327`) and toggles `<html>` classes (`is-mode-*`, `input-filter-*`, `:20-40`), so CSS and in-world prompt textures swap icons automatically (`Intro.js:126-182`). **Filters** (`intro` -> `wandering`) disable whole action sets by state (`Reveal.js:174-175`).

**Drive mapping** (`Player.js:522-600`): W/Up = accelerate, S/Down = reverse, A/D steer +-1, Shift boost, B/Ctrl brake, Space jump, R respawn, E/Enter/F interact, H honk. Gamepad left stick for steering. `Player` zeroes inputs unless `state === STATE_DEFAULT`.

**Touch** (`Inputs/Nipple.js`, SOURCE header + shader `:1-70`): a **3D joystick drawn in the world** (ring geometry + TSL SDF shader) under the thumb; throttle = `progress^3`, steering from the smallest angle between thumb direction and truck heading, with a "forward arc" of 270 degrees; reverse when thumb is behind (`Player.js:~555-590`). A tap = jump (`Player.js:~300-320`). Touch input is designed around the *vehicle's heading*, not screen axes.

**Camera** (SOURCE `View.js`): fixed-angle orbit follow, not a free orbit.
- `PerspectiveCamera(fov 25, ..., near 0.1, far 200)` (`:394`). Narrow FOV + far distance = near-isometric diorama.
- Spherical offset: `phi = 0.31pi` (0.27pi mobile), `theta = 0.25pi` (45 degrees), radius lerps 15 -> 30 with a zoom ratio (`:332-340`). Mouse wheel changes `baseRatio` (`:284-310`).
- **Focus point** tracks the vehicle position with exponential easing `lerp(smoothed, target, delta*10)` (`:116-170, ~650`) and a "magnet" mode used during the intro.
- **Zoom-out with speed**: ratio -= 0.4 * smoothstep(speed, 5, 40) when tracking on high quality (`:~660`).
- Roll spring: damped spring, `kick()` for impacts (`:358-390`).
- `ratioOverflow` widens the radius on narrow aspect ratios so content stays in frame (`:~34-37, 664`).
- **`optimalArea`**: each frame the camera frustum is intersected with the ground plane to get the visible footprint quad, centre and radius (`:172-283`). That one measurement sizes the shadow ortho box (`Ligthing.js:17,25`), grass patch (`Grass.js:10`), fog near/far (`Fog.js:20-21`), and culling. Hand-rolled but the idea is generic and strong.
- Free fly debug mode via `camera-controls` (`V` key, `View.js:~60-98, 413-420`), cinematic mode lerps the camera to authored position/target (`:422-460, ~700`).
- `RayCursor.js`: 3D picking against analytic shapes (spheres) rather than meshes - used for the intro click zone and sound button (`Reveal.js:124-136`).

---

## 6. Intro, loading, first 15 seconds (hook-critical)

Timeline reconstructed from code and confirmed by `01-load-*.png` (SOURCE unless noted):

| t | what the visitor sees | where |
|---|---|---|
| 0 s | Dark plum void, violet "x" grid on the floor, **a thin glowing white ring drawing itself like a clock hand**. Ring fill angle = load progress. | `Grid` + `Intro.setCircle` `Intro.js:51-73`; progress `Game.js:175-178` |
| ~2-6 s (network) | Ring completes. Rendering starts only after a 3-frame wait (so shader compile doesn't drop frames visibly) | `Game.js:206-209` |
| +0 | Ring **shrinks to zero in 1.5 s with `power4.in`** (slow then snap) | `Intro.js:88-113` |
| +1.5 | A circular patch of the world **bursts open (2 s, `back.out(1.7)`, overshoot)** exposing truck, bench, tree, lantern, with a bloom rim; camera pulls from zoom 0.6 to 0.3 over 1.25 s | `Reveal.js:54-85` |
| +2.2 | Handwritten label "CLICK TO START" + arrow + sound toggle appear beside the truck. Label texture swaps per input device (keyboard/xbox/ps/touch). Hovering the circle raises glow 22 % | `Reveal.js:87-93, 124-136`; `Intro.js:116-258` |
| click | Audio context unlocks (`audio.init()`), reveal sound plays, circle **expands to radius 30 (2 s, `back.in(1.3)`)** while camera zooms to play distance (1.75 s `back.in(1.5)`), input filter switches to `wandering`; control is yours | `Reveal.js:149-210` |
| ~+2 s | `world.step(2)`, grid and intro destroyed, WebSocket opens, menu button appears | `Reveal.js:211-227` |

Observations for our rubric: (1) the first screen is a *progress indicator that is already the brand*, not a spinner; (2) loading is staged (tiny first batch so something exists in <1 s, the rest during the ring); (3) the click is both the browser audio-unlock gesture and the "you chose to enter" beat; (4) `#skip` in the URL runs reveal at 4x and auto-advances (`Reveal.js:48, 100-103`) - essential for a dev loop and for a 3-minute demo. First interactive frame is probably ~6-10 s on a warm cache (GUESS; I measured screenshot timing only).

---

## 7. Audio (SOURCE `Audio.js`, 769 lines)

- **Howler.js**. `Audio.register(opts)` wraps `Howl` with: group, loop, volume, preload, `antiSpam` (min gap 0.1 s), `rate`, `positions[]` + `distanceFade`, `onPlaying` hook (`:45-146`). Groups expose `play()` and `playRandomNext()` (never repeats the last id) (`:60-84`).
- **Fake spatial audio** (`update`, `:713-769`): for each positional sound the nearest world position is transformed into camera space, normalised, `z *= 0.1`, and fed to `howl.pos()` so it pans left/right with the camera; volume is `remapClamp(distance, 0, distanceFade, 1, 0)`; sounds below 0.01 are muted. Cheap, works with a top-down camera.
- **Global rate follows time scale** (`:714`, clamp 0.5-4) so bullet-time pitch-bends everything.
- `audio.init()` runs on the intro click (browser autoplay rule) (`Reveal.js:152`). Mute button persists (`setMute`, `:638-711`).
- Content: 3 music tracks (`Sudo, Boy, Baguira`, in a jukebox playlist `:147-160`), time-of-day ambience (owl, rooster, wolf, crickets `:318-395`), weather loops (rain, wind, lake waves, Christmas bells `:410-455`), fire, UI mechanisms, engine loop (`Player.js:152-156`, rate/volume bound to speed - PARTIAL), collision hits triggered from physics (`PhysicsVehicle.js:102-104`). Ambient layers are gated by `dayCycles` intervals (GUESS from names; `Cycles.js:168-195` provides the events).
- Feel: warm, foley-heavy, many short one-shots with randomised variants; music is optional and diegetic (jukebox). No constant score.

---

## 8. Asset pipeline

1. **Model in Blender** with naming conventions: `*Physical*` collections of `cuboid/hull/trimesh/tube/ball` primitives; separate visual glb; `...References.glb` files hold only empties/transforms used for instancing (trees, bushes, flowers, respawns, tornado path) (`Game.js:104,138-139,148-153`, `Objects.js:116-221`). SOURCE.
2. **Palette**: UV islands onto the 128x4 `palette.png` swatches; palette node muted at export (`readme.md` Blender/Export). SOURCE.
3. **Export** with presets, no compression (`readme.md`).
4. **`npm run compress`** -> `scripts/compress.js` (146 lines): walks `static/`, for each `.glb` writes `*-compressed.glb` (skips outputs by regex `/-(draco|ktx|compressed).glb$/`, `:20`) with **embedded textures to KTX2 ETC1S quality 255** (`:29-37`) then **Draco geometry** (`:46-52`) through `@gltf-transform/cli`; for loose `png|jpg` runs `toktx` with per-path presets: default ETC1S sRGB RGB (`:80`), single-channel `--target_type R --swizzle r001` for masks/SDFs/icons (`:82-91`), **UASTC for palette (with mipmaps), terrain data, overlay** where quality matters (`:92-94`); UI images -> WebP via sharp. SOURCE.
5. **Loader**: `GLTFLoader + DRACOLoader('./draco/') + KTX2Loader('./basis/')` with `detectSupport(renderer)` (`ResourcesLoader.js:~20-45`). A `VITE_COMPRESSED` env toggles `-compressed` suffix and `.ktx` vs `.png` (`Game.js:97-100`) so dev iterates on raw files and prod ships compressed. Result cache keyed by path (`ResourcesLoader.js:~60-75`). SOURCE.
6. Cache busting via `?cb=1` query on every URL (`Game.js:102`). Repo `static/` is 196 MB incl. raw + compressed twins (measured `du`), the shipped set is smaller (GUESS).
7. Note: ordinary textures are **data, not images**: foliage SDF, terrain splat, slab pattern, glyph atlases are single-channel. Few colour textures exist at all.

---

## 9. Quality tiers and performance tricks

`Quality.js` is 48 lines: `level = isMobile ? 1 : 0` by UA regex (`:12-13`), `changeLevel()` fires `'change'`. Consumers (grep of `quality.level`): `Ligthing.js` (shadow map 2048 vs 512, radius 3 vs 2), `Rendering.js` (bloom mips 5 vs 2; DOF only at 0), `View.js` (camera phi, speed-zoom only at 0), `PhysicsVehicle.js` (fixed 1/60 vs averaged delta), `World/WaterSurface.js`, `World/Intro.js` (label layout), `Game.js` (PreRenderer only at 0), `Options.js` (UI toggle). SOURCE. Two tiers, no auto-detect from fps.

Tricks, all SOURCE unless marked:
- **Instancing for everything repeated**: `InstancedGroup` builds an `InstancedMesh` per sub-mesh from a list of reference empties; only updates matrices for refs flagged `needsUpdate` (physical benches/fences/bricks/lanterns that got knocked) (`InstancedGroup.js:28-119`). Trees, bushes, flowers via references glb.
- **Camera-sized effects**: grass, shadows, fog and culling sized from `optimalArea`.
- **Single material = few shader variants**; palette texture = one binding for most props.
- `renderer.sortObjects=false` + manual `renderOrder` (`Rendering.js:48-60`).
- `PreRenderer` pipeline warm-up (`Game.js:203`).
- Delta clamp 1/30; fixed per-frame work; `viewport 'throttleChange'` event separates cheap resize from expensive rebuild (`Viewport.js`, used `Ligthing.js:48`, `Grass.js:34`).
- KTX2/Draco everything; single-channel textures.
- Stage-loaded world (`World.step(0/1/2)`).
- `antialias: pixelRatio < 2` (`Rendering.js:44`): MSAA only where DPR is low; hi-DPR relies on pixel density.
- Debug perf HUD via `#stats` and three Inspector (`Rendering.js:62, 133`). `stats-gl` is imported by `Monitoring.js` (commented out of `Game.js:15,198`).

---

## 10. Multiplayer / WebSocket (SOURCE `Server.js`, 132 lines)

It is **not** real-time multiplayer. No other players' trucks are synced. It is an asynchronous shared-state server:
- `uuid` persisted in localStorage (`:12-18`). Retries `connect()` every 2 s while disconnected (`:34-38`). Starts only after reveal step 2 (`Reveal.js:222`) and only if `VITE_SERVER_URL` is set (`:28`) - **so the client runs fully without a server**. The HTML gets `is-server-online/offline` classes to hide server-only UI (`:23, 50-51`).
- Wire format: **msgpack** over binary WebSocket (`:124-132`); every message includes `uuid`.
- Messages sent: `whispersInsert {message, countryCode, x,y,z}` (`Whispers.js:309`), `circuitInsert {countryCode, tag(3 chars), duration, checkpointTimings}` (`CircuitArea.js:1290`). Received: `init` (initial snapshot, cached in `server.initData` `:110-111`), whisper updates, `cataclysmUpdate` which starts/stops the tornado for everyone (`Tornado.js:121-131`), easter-event data (`Easter.js:139`).
- Server code is NOT in this repo (PARTIAL: only the client contract is visible). `VITE_SERVER_URL` comes from `.env.example`.

**If we borrow:** stub `Server` with the same `send / events.on('message') / connected / initData` surface and a local in-memory or `BroadcastChannel`/localStorage fake. Anything gated on `server.connected` already degrades (whisper submit requires it, `Whispers.js:306`). If we want a real one, one tiny `ws` + msgpack (or JSON) relay with `init` + `insert` is enough. Sanitise text (`sanatize(...)` is used client-side, `Whispers.js:287-306`, but never trust it) and keep it behind the builder-security rules if we ever expose a socket.

---

## 11. UX hooks and delight

- **Achievements** (SOURCE `Achievements.js`, `data/achievements.js`): data-driven tuples `[ key, title, description, target, unique? ]`, progress counter or `Set` persisted to `localStorage('achievements')` (`:~48-70`). Titles are jokes ("But can you fix the wifi?", "Turtle" for flipping over, "Wake & bake" for cookies). Many are triggered by the vehicle events in section 4 (`upsideDown`, `flip`, suspensions `Player.js:~300`). Global progress, rewards, reset. This is the discovery engine: the list *teaches the world's verbs*.
- **Konami code** swaps the truck model to an "oldSchool" glb and pops confetti (`KonamiCode.js:13-77`), also grants an achievement.
- **Interactive points**: floating diamond markers (see `03-driving.png`) with key icon textures that follow input mode (`InteractivePoints.js`, 663 lines; PARTIAL).
- **Whispers**: visitors post short messages that appear as flames in the world at their position (`Whispers.js`).
- **Circuit race** with leaderboard and checkpoint timings (`CircuitArea.js`, ~1300 lines; PARTIAL).
- **Server-triggered tornado/cataclysm** shared for all visitors (`Tornado.js`).
- **Mini-games as areas**: bowling, cookie clicker, toilet, time machine, "behind the scene", altar. Each is a self-contained `Area` subclass (`World/Areas/*.js`).
- **Seasonal events** (static folders `christmas/`, `easter/`, `blackFriday/`) injected by date/server (PARTIAL).
- **Menu/map** (`Menu.js`, `Map.js`), notifications toast (`Notifications.js`, visible "Server connected" in screenshot), respawn points and an easy `R` respawn.
- **Camera personality**: roll kick on hits, speed-based zoom-out, speed lines on boost.
- **Small ones**: honk (H), sound-reactive jukebox, leaves falling in fall, ice physics in winter, rain streaks, fish in the "under the sea" achievement.

---

## 12. STYLE DNA (artist brief)

**One-liner:** *A sunset toy diorama.* Matte flat-colour low-poly props, saturated warm key light, violet shadows, glowing accents, shallow tilt-shift, soft round-cornered chunky shapes, all viewed from a cinematic 45 degree high angle with a narrow lens.

**Palette** (SOURCE where hex given from code/decoded palette, GUESS where from screenshots):
- Day cycle key light: day `#ffd2c2` (peach white), dusk `#ff8181`, night `#3240ff`, dawn `#ffa882` (`DayCycles.js:5-8`).
- **Shadow colours are saturated, not grey**: day `#6d3fff`, dusk `#4e009c`, night `#2f00db`, dawn `#db004f`.
- Fog/sky gradients (A -> B): day `#00ffff -> #9b89ff`, dusk `#3e53ff -> #ff4ce4`, night `#10266f -> #490a42`, dawn `#f885ff -> #ff7d24`.
- Reveal rim: day `#5f7dff`, dusk `#ff86d9`, night `#b678ff`, dawn `#ff9d9d`; default `#e88eff` (`Reveal.js:18`).
- Terrain ramp: dirt/sand `#ffa94e`, shallow water `#5bc2b9`, deep `#13375f`, grass `#b8b62e` (`Terrain.js:45-49,85`).
- Prop palette swatches (decoded from `palette.png`, local analysis only): `#e4a90c #f8a658 #e56202 #ed3f1c #c30e3a #ed719f #c366ef #3dbbe7 #91ad78 #abae2b #988165 #b36d45 #574e37 #4a413c #575a5e #7c7691 #c8c2c1 #eec3af #fde6e1 #1e0603 #ebd1a3 #a49876 #e49a78`. Note: warm autumn core plus a few cold accents (cyan, violet, magenta). Roughly 25-30 colours total for the whole world.
- Emissives: orange `#ff8641/#ff3e00`, purple `#454bbc/#ff2eb4`, blue `#91f0ff/#128fff`, green `#f8ffa6/#74ff00`.
- Intro void: near-black plum (about `#1c0f18`, GUESS from `01-load-0.png`) with `#a35bd9`-ish violet x markers and a white-hot ring.

**Shape language:** chunky, rounded, toy-scale low-poly. Boxy trucks, thick fences, stacked crates, beveled stone slabs. Foliage as dithered/stippled spherical clumps (alpha SDF), grass as thin spiky blades in dense fields, leaves as tiny confetti. No outlines. No textures except flat swatches.

**Lighting mood:** single directional "sun" with coloured tinted shadows (violet on warm ground), terminator cel-step (`coreShadowEdge`), light bounce coloured by ground, strong rim-glow on emissives with HDR bloom (threshold 1, strength 0.25). Golden/magenta hour is the home state; night turns to deep blue/violet with warm lanterns popping.

**Camera framing:** about 45 degree yaw, high pitch (phi 0.31pi from vertical), FOV 25, truck slightly below centre; tilt-shift blur on top/bottom thirds; slight roll and zoom-out at speed. Everything in the middle band is sharp.

**Motion feel:** springy and overshooting. Intro uses `back.out(1.7)` and `back.in(1.3-1.5)` (`Reveal.js`). Physical suspension squat and hop, bounce on collisions, camera roll kicks. Time runs at 2x game speed with bullet-time slow-mo. Everything eases; nothing snaps except the final ring collapse (`power4.in`).

**Typography (PARTIAL, from CSS + screenshots):** `Pally` (Regular/Medium/Bold/Variable) is bundled as the UI face (`style/fonts.styl:1-30`); handwritten condensed caps ("Amatic SC") for key icons/intro label (`style/interactiveButtons.styl:39`); `Nunito` as a body fallback (`:35`). In-world labels use rounded handwritten caps on dark translucent bars; the hero name is **huge extruded 3D pink letters lying on the ground** (screenshot `03-driving.png`).

**Sound feel:** warm foley, wooden/mechanical clicks, birds/crickets by hour, rain/wind beds, quiet jukebox music chosen by the player; sounds are pitch-shifted with game speed. Nothing sci-fi or compressed; mixed at modest volume (0.5 default).

---

## 13. STEAL LIST FOR NEW WORLDS

Rubric from `docs/TRACK.md`: Creativity 45 %, Presentation 30 %, Technical 25 % (multipliers x9 / x6 / x5; first-15-second hook and >=50 fps called out). "Reuse" = copy the pattern nearly verbatim into our code (MIT code, our own assets); "Port" = reimplement the idea.

| # | Technique | Effort | Reuse / Port | Helps | Source |
|---|---|---|---|---|---|
| 1 | Circle-reveal intro: loader ring that is the brand + world bursts open via a `discard` radius uniform + rim glow (`revealDiscardNodeBuilder`) | S | Reuse (TSL, ~40 lines) | Presentation (15 s hook), Creativity | `MeshDefaultMaterial.js:7-19`, `Reveal.js:54-210`, `Intro.js:51-113` |
| 2 | `Events.on(name, cb, order)` priority tick bus + `Ticker` with clamped delta, scaled time, TSL time uniforms | S | Reuse | Technical (clean, stable) | `Events.js`, `Ticker.js` |
| 3 | `Time` scale linked to ticker + gsap + audio rate; bullet-time ramp | S | Reuse | Presentation (juice), Technical | `Time.js`, `Audio.js:714` |
| 4 | Palette-texture material (NearestFilter 128x4, UV swatches) | S | Port (make our own palette) | Creativity (cohesive world), Technical (perf) | `Materials.js:36-44`, `Game.js:107` |
| 5 | Custom node-material pipeline: bounce from terrain, core shadow, tinted shadow, fog, all in one `outputNode` | M | Port (rewrite for our look) | Technical | `MeshDefaultMaterial.js:67-134` |
| 6 | Bloom threshold-1 + HDR emissive normalised by luminance | S | Reuse | Creativity (glow), Presentation | `Rendering.js:80-85`, `Materials.js:113-178` |
| 7 | Cheap tilt-shift DOF (hashBlur by |uv.y-0.5|) | S | Reuse | Creativity (miniature look) | `Passes/cheapDOF.js` |
| 8 | Day/year cycles with keyframed property bag + interval events, optionally driven by real clock/data | M | Reuse the `Cycles` class, replace presets | Creativity (world has time), "new data" angle | `Cycles/Cycles.js`, `DayCycles.js` |
| 9 | Data-texture terrain (RGB channels -> gradient/grass/tracks) + wheel-track render target | M | Port | Technical, Creativity | `Terrain.js`, `Tracks.js` |
| 10 | `optimalArea` (frustum footprint on ground) sizing shadows, grass, fog | M | Port | Technical (perf at 50 fps) | `View.js:172-283` |
| 11 | Rapier raycast vehicle with detectors (flip, stuck, upside-down) -> events | M | Reuse (tune numbers) | Technical, Creativity (verb) | `PhysicsVehicle.js` |
| 12 | Blender-name -> Rapier collider authoring (`cuboid*/hull*/trimesh*`) | M | Reuse | Technical, speed of content | `Objects.js:116-221` |
| 13 | SDF-alpha foliage clumps with wind rotation and see-through-near-player | M | Port | Creativity (distinct look) | `Foliage.js` |
| 14 | Instanced grass field sized to camera area | M | Port | Creativity, Technical | `Grass.js` |
| 15 | Action/filter input layer + auto device-mode UI swap + 3D touch joystick | M | Reuse partly | Presentation (works on judge's laptop/phone) | `Inputs/*`, `Nipple.js` |
| 16 | Fixed-angle follow camera with speed zoom, roll kick, easing focus point, `ratioOverflow` | S | Port | Presentation | `View.js` |
| 17 | Howler wrapper with groups, antiSpam, fake-pan, distance fade | S | Reuse | Presentation (sound sells world) | `Audio.js:45-146, 713-769` |
| 18 | `#skip`, `#stats`, `#inspector` URL-hash dev switches | S | Reuse | Process (demo rehearsal, perf proof) | `Reveal.js:48`, `Rendering.js:62,133` |
| 19 | Achievements as teaching/discovery layer + localStorage | S | Reuse (data-driven tuples) | Creativity (discover rules), Presentation | `Achievements.js`, `data/achievements.js` |
| 20 | Optional server with graceful offline (`is-server-*` classes, msgpack) | M | Stub | Technical (multiplayer tick) | `Server.js` |
| 21 | Compress script: gltf-transform + toktx presets | M | Reuse the flow | Technical (load time) | `scripts/compress.js` |
| 22 | `PreRenderer` shader warm-up via cube camera | S | Reuse | Presentation (no hitch on demo) | `PreRenderer.js` |
| 23 | Instanced reset-able physics props | M | Reuse | Technical | `InstancedGroup.js`, `Objects.js:229-280` |

### What a 24 h team can realistically borrow (top 5)

1. **Circle-reveal intro + ring loader + click-to-start unlock** (#1, #22). 2-3 h. Directly attacks the 15-second hook. Pair with a personal first line (the judge's name/city) to hit "personal story" on the presentation rubric.
2. **Ticker/Events/Time spine** (#2, #3) and the hash debug switches (#18). 1 h. It is the scaffold and makes every later feature plug-in.
3. **Look kit: palette-texture material + bloom@1 + emissive normalisation + tilt-shift DOF + tinted shadows** (#4, #6, #7, plus a *simplified* #5). 4-6 h. Gets 80 % of the "this is a world" feel; skip the terrain-bounce and foliage SDF unless time remains.
4. **Day/Year `Cycles` class driving light/fog/audio** (#8). 2 h. For New Worlds this is the cheapest way to make the world *change over time* or be driven by external data (feed it real values instead of Date.now()).
5. **Rapier raycast vehicle (or any single verb) + event detectors + achievements** (#11, #19). 4-6 h. Supplies "something to do" (the track brief warns about "pretty scene, nothing to do") and a built-in discovery loop.
Skip: whole-area minigames, tornado/leaderboard server, Nipple (unless mobile demo), grass+foliage shaders (nice, time sinks).

---

## 14. Starter skeleton recommendation

Mirror this minimal module set (all vanilla JS classes on a singleton, ~600-800 lines total to start). Use TypeScript only if the team is fluent; the original is plain JS.

| Module | Mirrors | Purpose / key lines to copy |
|---|---|---|
| `Game.ts` | `Game.js:54-216` | Singleton, staged boot: core -> small first resource batch -> render start -> big batch + Rapier dynamic import in `Promise.all` -> reveal. Keep `getInstance()`. |
| `Events.ts` | `Events.js` | Ordered callbacks (copy as is). |
| `Ticker.ts` | `Ticker.js` | `setAnimationLoop` -> clamp delta, scaled time, TSL `uniform` time/delta, `wait(frames, cb)`. |
| `Time.ts` | `Time.js` | One scale knob for ticker + gsap + audio; bullet-time. |
| `Rendering.ts` | `Rendering.js:38-131` | `WebGPURenderer` init, `RenderPipeline` with `pass` -> bloom(threshold 1) [+ cheapDOF on high], quality-switchable `outputNode`, render at tick order 998, `#stats`/`#inspector`. |
| `Quality.ts` | `Quality.js` | `level` 0/1, `change` event; wire to shadow map size, bloom mips, DOF, pixel ratio. Add an fps-based auto-downgrade (the original lacks it). |
| `Materials.ts` + `MeshDefaultMaterial.ts` | `Materials.js`, `MeshDefaultMaterial.js` | Palette material, emissive helper, single `outputNode` shader with light/core shadow/tinted shadow/fog/reveal. |
| `Lighting.ts` / `Fog.ts` / `Cycles.ts` | `Ligthing.js`, `Fog.js`, `Cycles/*` | Uniform-driven sun + radial background + range fog, fed by a keyframed property bag. |
| `Physics.ts` | `Physics/Physics.js:10-63, 85-239, 243-313` | Rapier world, collision groups, `getPhysical()`, contact-force callback, per-frame `timestep`. |
| `Objects.ts` | `Objects.js:21-280` | Visual<->physical registry, `getFromModel` collider-by-name, reset. |
| `PhysicsVehicle.ts` (if driving) | `PhysicsVehicle.js:14-21, 69, 131-183, 462-512` | Raycast vehicle controller, tuning, detectors. Replace with our own verb if we are not driving. |
| `Inputs.ts` | `Inputs/Inputs.js`, `Keyboard.js`, `Gamepad.js` | Named actions + categories + filters; skip Nipple/Wheel at first. |
| `View.ts` | `View.js:284-390, 392-396, 620-700` | Follow camera: spherical offset, focus easing, speed zoom, roll kick. Add `optimalArea` only if shadows/grass need it. |
| `Reveal.ts` + `Intro.ts` | `Reveal.js`, `Intro.js` | Ring loader + circle reveal + click-to-start, `#skip`. |
| `ResourcesLoader.ts` | `ResourcesLoader.js` | glTF + Draco + KTX2 with progress callback and cache. |
| `Audio.ts` | `Audio.js:45-146, 713-769` | Howler groups, fake pan, unlock on first click. |
| `Server.ts` (stub) | `Server.js` | Same API, offline-safe. |
| `Achievements.ts` | `Achievements.js` + `data/achievements.js` | Tuple data + localStorage. |
| `scripts/compress.js` | `scripts/compress.js` | Optional; only if load > 5 s. |

Dependencies actually used (SOURCE `package.json`): `three ^0.187.0`, `@dimforge/rapier3d ^0.19.3`, `gsap`, `howler`, `camera-controls` (debug free-cam only), `seedrandom`, `msgpack-lite`, `uuid`, `tweakpane` (+plugins; debug panel, optional), `stats-gl` (commented out), `vite ^8` + `vite-plugin-wasm` + `vite-plugin-node-polyfills`, `sharp` + `@gltf-transform/*` (build-time). Build config is tiny (`vite.config.js`: root `sources/`, `publicDir ../static/`, `base './'`). Strip: Black Friday / Easter / Christmas promo code, analytics-style discount code, `consoleLog` banner, and the personal data under `sources/data/`.

### Risks and caveats (GUESS/PARTIAL flagged)
- WebGPURenderer + TSL API moves fast; this repo pins three 0.187. Copying snippets into a different three version may break `RenderPipeline`, `BloomNode` path (`three/addons/tsl/display/BloomNode.js`) or `hashBlur` path (`three/examples/jsm/tsl/display/hashBlur.js`). Pin the same version.
- `bloomPass._nMips` is a private field (`Rendering.js:82`). Expect it to change.
- `threejs-override.js` monkey-patches `Object3D.prototype.copy` (SOURCE `:3-40`); I did not trace why (GUESS: preserve `matrixWorld`/flags on clone for instancing).
- Variable physics timestep means replays are not deterministic; fine for us.
- Headless WebGPU worked here, so automated screenshots of our own project should too (same flags used in the recon script, `/tmp/bs-shots/shot.py`).
- Performance numbers (fps, draw calls) were not measured: add `#stats` on the live site if needed.
