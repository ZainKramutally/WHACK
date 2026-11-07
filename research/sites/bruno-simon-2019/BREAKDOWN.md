# Bruno Simon 2019 portfolio - teardown

Site: https://2019.bruno-simon.com/ . Repo: https://github.com/brunosimon/folio-2019 (MIT, `license.md`; HEAD `540f135`, last commit 2024-05-06, ported to Vite + three ^0.164.1).
Source read locally at `/tmp/whack-src/bruno-simon-2019` (untrusted, nothing installed or run). Paths below are relative to `src/javascript/` unless they start with `shaders/` (= `src/shaders/`) or `static/`.
Tags: **SOURCE** (path:line, read in the real code) / **PARTIAL** / **GUESS**. Untagged = SOURCE with the citation given.
Screenshots (live site, headless swiftshader, 1440x900): `RECON/screenshots/01..06*.png`. We do not copy his models, textures or sounds; reference by path only.

---

## 1. Summary

A portfolio rendered as a toy-box diorama: a small orange-ground world with a chunky red 4x4 you drive with the arrow keys. The site has no pages and no nav. Every "section" (Intro, Crossroads, Projects, Information, Playground) is a spot on one continuous 2D plane. The name "BRUNO SIMON" is built from physical 3D letters you can plough through, the instructions are 3D keycaps on the ground, links are glowing floor rectangles you park on and press Enter. It works as a "world" because (a) the first input is a verb (drive), not a menu; (b) everything you touch has weight and sound (bricks, bowling pins, letters, horns), so the space feels inhabited, and (c) the look is one tight system (a single orange gradient ground, a dozen matcap colours, soft fake shadows, no real lights) so the whole place reads as "one authored material". [SOURCE: `World/index.js:60-79` boot order; `World/Sections/*`]

It is not a big world: 5 sections laid out on a ~100 x 100 unit plane (`World/index.js:451-495`, section origins (0,0), (0,-30), (30,-30), (1.2,-55), (-38,-34)), 5.3 MB of models + 7.2 MB of audio (`du -sh static/models static/sounds`, SOURCE). The perceived size is the camera and the density of small physical props, not the scale.

---

## 2. Architecture

**Entry**: `index.js:4` does `window.application = new Application({ $canvas })`. Vanilla ES modules, no framework, one `<canvas>` and one hidden DOM overlay (the Three.js Journey ad, `index.html:44+`).

**Class tree** [SOURCE]:
```
Application (Application.js:17)          owns renderer, scene, composer, tab-title gag
 |- Time (Utils/Time.js)                  rAF loop + EventEmitter 'tick'; delta clamped to 60 ms (Time.js:34)
 |- Sizes, Resources(Loader)              Resources.js:15-225 = flat manifest of every asset; emits progress/ready
 |- Camera                                fixed-angle follow cam + pan + zoom
 |- passes{composer, blurH, blurV, glows}
 \- World (World/index.js)
     |- Sounds, Controls, Floor, Areas, startingScreen   built in constructor (before assets are even ready)
     \- start() [after clicking START]: Reveal, Materials, Shadows, Physics, Zones, Objects, Car,
        Tiles, Walls, Sections(intro/crossroads/projects/information/playground), EasterEggs
```

**Update loop**: there is no central `update()`. Everything calls `time.on('tick', fn)` in its own constructor, so tick order = construction order (listeners fire in registration order, `Utils/EventEmitter.js`, PARTIAL: I did not re-read its dispatch order but it is a plain array). Practical order per frame:
1. Application camera-target listener (`Application.js:118-125`, camera.target = car chassis x,y)
2. Camera eases + positions itself (`Camera.js:90-108`)
3. Composer render (`Application.js:195-204`) - registered in `setPasses()` BEFORE `setWorld()`, so the frame renders the state from the previous tick's physics. A one-frame lag; invisible at this camera.
4. World reveal uniforms, then `Physics.world.step(delta/1000)` (`World/Physics.js:28-31`, variable step, no fixed accumulator), then per-object mesh copy listeners.

**World <-> physics sync** [SOURCE]: one-way, body to mesh, every tick.
- Dynamic props: `Objects.add()` registers `time.on('tick', ...)` that does `container.position.copy(body.position); container.quaternion.copy(body.quaternion)` (`World/Objects.js:340-347`). Static props (`mass === 0`) set `matrixAutoUpdate = false` and never sync (`Objects.js:295-306`).
- Car: chassis mesh copied from chassis body + fixed offset `(0,0,-0.28)` (`World/Car.js:109,126-127`); each wheel mesh copied from the raycast-vehicle wheel transform (`Car.js:258-265`).
- Debug wireframe twin of every collider lives under `physics.models.container` (invisible by default, `Physics.js:50-58, 754-760`).
- Coordinate system is **Z-up** everywhere (camera `up.set(0,0,1)` at `Camera.js:77`, gravity on z at `Physics.js:37`). It matches Blender's export, so no axis swaps.

**Pattern worth stealing**: two glb files per object, `base.glb` (visual) + `collision.glb` (primitives only), merged by `Objects.add({base, collision, mass, shadow, soundName})` (`Objects.js:265-353`). See section 8.

---

## 3. Rendering and materials

**No real-time lights at all.** `ShaderMaterial` with `lights: false` for everything (`Materials/Matcap.js:36-45`); no `THREE.Light` anywhere in `src/` (PARTIAL: grep for `Light(` was not run exhaustively, but `Materials/*` and `World/Shadows.js` show none). Lighting is faked by four layers:

1. **Matcap shading** with a hand-edited Fragment shader: `shaders/matcap/fragment.glsl:59-66` computes the standard matcap UV from view-space normal (`vec3 x = normalize(vec3(viewDir.z, 0.0, -viewDir.x)); ... uv = vec2(dot(x, normal), dot(y, normal)) * 0.495 + 0.5`). 13 matcap PNGs (128x128) in `static/models/matcaps/` (beige, black, blue, brown, emeraldGreen, gold(unused), gray, green, metal, orange, purple, red, white, yellow) loaded in `Resources.js:17-29`. Each colour = one `MatcapMaterial` (`World/Materials.js:41-135`).
2. **"Indirect bounce" tint** added to the matcap shader: surfaces facing the ground and close to it are mixed toward the ground colour `#d04500`, as fake radiosity. (`shaders/matcap/fragment.glsl:78-95`)
   ```glsl
   float indirectDistanceStrength = clamp(1.0 - vWorldPosition.z / uIndirectDistanceAmplitude, 0.0, 1.0) * uIndirectDistanceStrength;
   float indirectAngleStrength = dot(normalize(worldNormal), vec3(0.0, 0.0, -1.0)) + uIndirectAngleOffset;
   gl_FragColor = vec4(mix(outgoingLight, uIndirectColor, indirectStrength), diffuseColor.a);
   ```
   Tuned values: amplitude 1.75, distance strength 0.5 / power 2, angle strength 1.5 / offset 0.6 (`World/Materials.js:48-57`). This is the single trick that makes white matcap bricks look "sitting in" an orange world rather than pasted on.
3. **Blob shadows from a fake sun**: each caster gets a `PlaneGeometry(1,1)` quad (`World/Shadows.js:149-152`) with a custom shader (`shaders/shadow/fragment.glsl`: rounded-rect falloff, `sineInOut`, `uFadeRadius 0.35`). Per tick the quad is offset along a fixed sun vector by the caster's height (`Shadows.js:67-71`, sun at `(-2.5,-2.65,3.75)`, line 103), rotated to the caster's yaw projected onto the ground (87-88), and alpha-faded by height (`maxDistance 3`, `distancePower 2`, lines 17-18, 91-95) and by how upright the caster is (81-85, tilted objects lose their shadow). Shadow colour is the same `#d04500` (line 20), not black. Drawn with `depthWrite=false` (143).
4. **Baked floor shadows**: static scenery ships a `floorShadow.png` (e.g. `static/models/crossroads/static/floorShadow.png`) applied to a mesh named `floor*` in the glb; shader is a 4-liner `shaders/floorShadow/fragment.glsl:9-12`: `alpha = (1 - tex.r) * uAlpha; gl_FragColor = vec4(uShadowColor, alpha)`. The parser regex `^floor_?[0-9]{0,3}?` swaps in this material (`Objects.js:93-114`).

**The ground is not geometry.** `World/Floor.js:15-61` builds a clip-space quad (`shaders/floor/vertex.glsl:9`: `gl_Position = vec4(position.xy, 1.0, 1.0)`) textured with a **2x2 `DataTexture`** of four corner colours, bilinearly filtered: top-left `#f5883c`, top-right `#ff9043`, bottom-right `#fccf92`, bottom-left `#f5aa58` (`Floor.js:20-23`). So the "world" is a screen-space gradient backdrop, and the physics floor is an infinite `CANNON.Plane` (`Physics.js:90-102`) with nothing drawn. The camera never rotates, so the illusion holds. Objects and baked shadows sit on the invisible plane. [SOURCE; confirmed visually in screenshots 04/05]

**Under-ground clip**: `if(vWorldPosition.z < 0.0) discard;` (`matcap/fragment.glsl:43-46`) so props can rise out of / drop through the plane without seeing back faces.

**Reveal animation baked into the vertex shader**: `shaders/matcap/vertex.glsl:57-67` pushes each vertex down by up to 3.2 units based on distance from world centre vs `uRevealProgress`; driven by gsap 0 to 1 over 3 s (`World/index.js:92`). The world "rises out of the floor" in a radial wave from the START pad. Shadows fade in 0.5 s later (index.js:93-94).

**Colour space**: custom `ShaderMaterial`s end with `#include <colorspace_fragment>` (shadow, projectBoard, matcap). Colours fed from hex are converted manually with `convertLinearToSRGB()` (`Application.js:169`, `Floor.js:35-38`). [SOURCE]. Note: his convention predates three's colour management; expect this to be the first thing that looks wrong when porting.

**Flat colour (unlit) materials**: `pureRed/pureWhite/pureYellow` = `MeshBasicMaterial` (`Materials.js:33-38`) for brake lights etc. Blender material-name prefix selects which (see section 8).

---

## 4. Post-processing

Only 3 passes after `RenderPass`, using the old `EffectComposer` (`Application.js:139-192`). [SOURCE]
| Pass | What | Where |
|---|---|---|
| horizontal + vertical blur | separable 9-tap blur, **masked by screen Y**: `blurStrength = 1.0 - sin(vUv.y * PI)` so the top and bottom edges are blurred, the middle band is sharp. A tilt-shift / depth-of-field fake. Strength 1 by default, tweened to 0 over 2 s when you enter the Projects zone so you can read the boards, and back out again. | `shaders/blur/fragment.glsl:11-17`; `Application.js:144-152`; zone tween `World/Sections/ProjectsSection.js:401-412` |
| glows | one big radial colour wash `#ffcfe0` at uv (0,0.25), radius 0.7, alpha 0.55, pre-composites a warm bloom into the lower-left. This is the pinkish haze in the bottom-left of every screenshot. | `shaders/glows/fragment.glsl:9-20`; params `Application.js:164-170` |
- No bloom, no SSAO, no FXAA/SMAA pass (renderer relies on MSAA of `WebGLRenderer` default + `setPixelRatio(2)`, `Application.js:92`).
- Touch handling: the pass is built with `config.touch ? 0 : 1` (`Application.js:145,150`), but `config.touch` is always false at that point (set on first `touchstart`), and the touchstart handler then sets strength to 1 again (57-60), so blur is effectively ON for touch too. Dead perf toggle. [SOURCE, my reading]
- Passes are skipped when strength is 0 (`Application.js:197-198`).

---

## 5. Physics and vehicle

**Engine**: cannon.js 0.6.2 (not cannon-es). `World` gravity `(0,0,-13)` (= `-3.25*4`), `allowSleep = true`, default friction 0, restitution 0.2 (`Physics.js:34-48`). Default broadphase (SAP is commented out, line 39). Three contact materials: floor/dummy friction 0.05, dummy/dummy 0.5, floor/wheel 0.3 (`Physics.js:67-88`). Variable timestep `world.step(delta/1000)` where `delta` is clamped to 60 ms.

**Car** = `CANNON.RaycastVehicle` on a box chassis [SOURCE `Physics.js:104-290`]:
- Chassis box 2.03 x 1.02 x 1.16, mass 40, offset z +0.41, `allowSleep=false` (121-125,179-182).
- 4 wheels r 0.25, suspension stiffness 50, rest length 0.1, travel 0.3, frictionSlip 10, damping relax/compress 1.8/1.5, rollInfluence 0.01 (low roll = hard to flip), `useCustomSlidingRotationalSpeed -30` (126-140,211-227).
- **Rear-wheel drive, front-wheel steer** in practice: `controlsSteeringQuad=false` (`Physics.js:142`) so only the front wheels steer; engine force always goes to the back wheels and to the front too only `if(controlsSteeringQuad)` (`Physics.js:560-567`), so the `controlsAcceleratingQuad` option (line 148) is never read (dead option). Steering max `PI*0.17`, rate `0.015` per ms, auto-centres when no key is held (`Physics.js:141-142, 481-511`).
- Max speed is checked on **measured position delta**, not velocity: `car.speed = |dPos| / delta` in `postStep` (356-357), engine force cut when over `0.055*3/17` (boost `0.11*3/17`) (144-145, 531-541). Boost = Shift, brake = Space/Ctrl.
- "Slow down" impulse opposing velocity when no throttle: `velocity.length() * 0.1` (`Physics.js:416-429`) - gives the car a gentle rolling stop instead of coasting forever with zero friction.
- **Self-righting**: if `worldUp . localUp < 0.5` for 1 s, then `jump()` impulse of 150 on z, with a cooldown (`Physics.js:367-396`, jump at 162-167). Plus `R` to recreate the car (`Physics.js:336-344`).
- **Horn = jump**: `H` plays a horn and calls `jump(false, 150)` every 400 ms (`World/Car.js:354-366`). So the horn is also a hop button, a free verb.
- **Car sits asleep at (0,0,12) until the reveal**, then drops in: `Physics.js:183-184`, `World/index.js:106-112`.

**Visual car** (`World/Car.js`): a chassis glb + one wheel glb cloned 4x + two light glbs + an antenna glb. [SOURCE]
- Antenna is a spring-damper on its own mesh: acceleration drives `speed`, `pullBackStrength 0.02`, `damping 0.035`, rotates around local x/y by `0.1 * pos` (`Car.js:135-186`). Cheapest secondary-motion trick in the project; the antenna whips on every turn.
- Brake light opacity 0.5 to 1 on Space; reverse light 0.5 to 1 on S/Down (`Car.js:232-236`).
- Screech sound when forward acceleration > 0.03, max once per 5 s (`Car.js:98-102`).

**Visual to collider mapping** (`Physics.js:629-795`, `Objects.js:308-320`) [SOURCE]: collision glb children are *named primitives*; the *name* picks the CANNON shape and the mesh's scale is the size:
- `/^cube_?[0-9]{0,3}?|box[0-9]{0,3}?$/i` to Box (halfExtents = scale/2), `cylinder*` to Cylinder(8 segments), `sphere*` to Sphere(scale.x), `center*` = pivot offset (not a shape). Position/quaternion copied from the glb child. No trimeshes, no convex hulls, ever. Then the visual children are shifted by `-collision.center` (`Objects.js:317-320`).
- Dynamic bodies use `sleepSpeedLimit = 0.01`, start asleep (`Physics.js:650-655`, `Objects.js:287`) so a world full of bricks costs ~0 until touched.
- Collision SFX hookup: `body.addEventListener('collide', e => sounds.play(name, e.contact.getImpactVelocityAlongNormal()))` (`Objects.js:322-330`).

---

## 6. Controls and camera

**Input** [SOURCE `World/Controls.js`]: `Arrows/WASD` drive, `Space/Ctrl` brake, `Shift` boost, `H` horn, `R` reset, `M` mute, `Enter/E/F` or click to activate an area. Keys write booleans into `controls.actions`; physics reads them per tick (no events in the hot path). `visibilitychange` clears all held keys (`Controls.js:32-43`) so alt-tab does not leave you accelerating.
**Touch**: custom DOM joystick (170 px circle bottom-left) whose *angle* is the target heading; steering is computed as the shortest signed angle between joystick and car heading, clamped to max steer (`Controls.js:139-310`, `Physics.js:457-477`). A boost button and the same layout shown via CSS opacity. Touch is detected by the first `touchstart` and everything flips (`Application.js:52-61`).

**Camera** (`Camera.js`) [SOURCE]:
- Perspective **FOV 40**, near 1, far 80 (73-76). Narrow FOV + far distance = near-orthographic "isometric" feel.
- Fixed *direction* vector `(1.135, -1.45, 1.15)`, normalised, times a zoom distance of `14 + 15*zoom` (default zoom 0.5 so ~21.5 units) (44-47, 99, 116-120). **The camera never rotates with the car.** World stays axis-aligned (this is why the fake floor works).
- Follow = exponential ease of the look-at target toward the chassis x,y: `eased += (target - eased) * 0.15` per frame (20-22, 92-97). Not frame-rate independent, fine at 60 fps (PARTIAL: tied to display refresh).
- **Zone-triggered angle change**: `angle.set('projects')` tweens the direction to `(0.38,-1.4,1.63)` (a higher, flatter-to-top view) over 2 s `power1.inOut` when you enter the Projects strip, same moment the blur goes to 0 (`Camera.js:44-61`, `ProjectsSection.js:395-412`). Zones are invisible AABBs tested against the car's x,y each tick (`World/Zones.js:49-66`).
- **Drag-to-pan**: you can grab the ground and look around; implemented by ray-casting the mouse onto a 500x500 hidden plane and storing the world-space delta; eased at 0.1; **resets to zero as soon as you press forward or back** (`Camera.js:165-330`, `Controls.js:57,68`). Pan is only enabled 2 s after reveal (`World/index.js:62-65`).
- Mousewheel / pinch zoom eased at 0.1 (`Camera.js:111-163`).

---

## 7. Intro, loading, first 15 seconds (hook rubric)

Timeline reconstructed from code + live screenshots [SOURCE unless marked]:
| t | What the user sees/hears | Code |
|---|---|---|
| 0 s | Black-orange canvas, a single outlined rectangle on the ground with the pixel-font word **LOADING**; the rectangle's border fills clockwise as assets stream in (angle-based shader mask) | `World/index.js:171-219`, `shaders/areaFloorBorder/fragment.glsl:10-14` (`uLoadProgress`); the Loading label is an inline base64 PNG (index.js:188) so it can show before any fetch |
| ~3-8 s (network) | Label cross-fades to **START** (0.3 s) and the border steps down to 30% alpha. Cursor is pointer. Screenshot `02-start-screen.png` | `index.js:222-232` |
| click / Enter | Border retracts, label fades (0.4 s delay), `start()` builds the entire world *now* (not before - the gate is also the audio-unlock user gesture) | `index.js:235-248` |
| +0.6 s | `reveal.go()`: matcaps wave out of the floor over 3 s, shadows follow at +0.5 s, instruction labels fade in +0.5 s / +0.75 s. Car body teleported to (0,0,12) and woken at +0.3 s: **it falls into frame**. Engine volume ramps 0 to 0.7 over 0.5 s, `reveal` sting plays at +0.4 s | `index.js:90-130` |
| +3 s | World fully formed; screenshot `04-revealed-intro.png` shows car, 3D keycaps with "USE YOUR ... KEYS TO MOVE AROUND", trees, brick walls. Drag-pan unlocks at +2 s | `index.js:62-65` |
| +5 s | First input; driving through the physical letters "BRUNO SIMON" / "CREATIVE DEV" knocks them over (screenshot `05-driving.png`) | `Sections/IntroSection.js:160-276` |
| ~75 units travelled | Three.js Journey chat bubble pops up bottom-right (once per N sessions, `localStorage`) | `ThreejsJourney.js:19-24,35-45` |

Why it works as a hook: the loading screen **is** the world's first object (an Area pad), so there is no spinner-to-scene discontinuity; the START gate gives a clean "now" moment with audio unlocked; the reveal is a 3 s authored entrance with a falling car; and the first obstacle you hit is the title itself.
**Weak spot (for us to avoid)**: ~5-8 s of loading before anything is interactive on a cold cache, and the START gate is a click on a rectangle, not obviously a button (my first headless attempt with the Enter key did nothing because the start Area has `testCar:false`, `World/index.js:176-182`; only the click path works).

Also: **the browser tab title is a tiny scrolling car**: `document.title = '____🚗__'` with position advancing by the car's forward speed, updated every 300 ms (`Application.js:240-268`). Free delight for anyone with the tab visible.

---

## 8. Asset pipeline (Blender to glb) and naming conventions

[SOURCE for naming rules; asset formats from `static/` listing and `Utils/Loader.js`]
- Source: `resources/3d/model.blend` + `render.blend` in-repo (not read). Export: **glTF binary (.glb), Draco-compressed** (loader `Utils/Loader.js:50-81`, decoder in `static/draco/`, `{type:'js'}` config, so no WASM path used). Total models 5.3 MB (`du`).
- Per object folder: `base.glb`, `collision.glb`, optional `floorShadow.png` (e.g. `static/models/intro/`, `/crossroads/static/`, `/playground/static/`). Dynamic props use the `dummy` contact material.
- **Mesh-name driven behaviour** (this is the high-value idea) in `World/Objects.js:29-126`:
  - `shadeWhite`, `shadeOrange_002` etc: `/^shade([a-z]+)_?[0-9]{0,3}?/i` assigns the matching matcap material (`shade` + PascalCase colour). Unknown colour falls back to `MeshNormalMaterial` so typos are loud.
  - `pureRed`, `pureYellow`: unlit `MeshBasicMaterial`.
  - `floor*`: replaced by the baked-shadow plane using the sibling `floorShadow.png`.
  - `center*`: empty used as the pivot (`Objects.js:222-226, 245-254`).
  - Anything else: default white shade (`Objects.js:117-126`).
  - Collision meshes: `cube*`/`box*`, `cylinder*`, `sphere*`, `center*` as in section 5.
- Textures: 128x128 matcap PNGs; label textures are **alpha-map only** (`MeshBasicMaterial({ alphaMap, color: 0xffffff })` with `NearestFilter` mag) so a 1-channel PNG gives crisp white text of any tint (`Area.js:129-133`, `IntroSection.js:55-59`). Project boards use webp/jpg slides (`ProjectsSection.js:77-81,103-105`) with a trivial `mix(vec4(color), tex, uTextureAlpha)` shader that fades each slide in (`shaders/projectBoard/fragment.glsl`).
- All assets in one flat name to path manifest (`Resources.js:15-225`); `type: 'texture'` entries also get a pre-made `THREE.Texture` stored as `<name>Texture` (`Resources.js:227-238`).
- Procedural scatter from small tile/brick libraries with weighted random pick + jitter: `World/Tiles.js` (5 stepping-stone variants, chances 8/1/2/4/2; `interDistance 1.5`, jitter 0.3) and `World/Walls.js` (brick/rectangle/triangle layouts with random offset/rotation). This is how the paths between sections and every brick wall get built from ~2 models.

---

## 9. Audio

Howler.js, MP3 + WAV in `static/sounds/` (7.2 MB, 12 sound groups). [SOURCE `World/Sounds.js`]
- **Velocity-mapped one-shots**: each group has `{minDelta, velocityMin, velocityMultiplier, volumeMin/Max, rateMin/Max}` and a *list of variants*; `play(name, impactVelocity)` picks a random variant, volume = `clamp((v - velMin) * mult)^2`, and a random playback rate in `[rateMin, rateMax]` (`Sounds.js:307-333`). Bricks play at rate 0.5-0.75 (deep clacks), car hits 0.35-0.55 (thuds), bowling 0.1-0.85. Pitching samples *down* is why a pile of white blocks sounds heavy and toy-like.
- **Engine**: a single looping sample `engines/1/low_off.mp3` with `rate` 0.4 to 1.4 and `volume` 0.4 to 1 driven by `progress`, which eases up at 0.3/frame and down at 0.15/frame from speed*2.5 + throttle (`Sounds.js:219-264`). A fake engine with one loop.
- `M` mutes; page blur mutes automatically (`Sounds.js:186-207`); master volume 0.5; engine master faded in on reveal.
- UI sound `uiArea` on area interact (`Area.js:197`), `reveal` sting (`index.js:116-118`), horn x2 variants (0.2% chance of the rare one, `Car.js:365`), screech.
- No music. PARTIAL: `engines/0` and `engines/2` exist in `static/` but only `1/low_off` is referenced.

---

## 10. Performance tricks

[SOURCE unless tagged]
1. **Zero lights, zero shadow maps** - the whole lighting model costs one matcap fetch per fragment (+ a few ALU ops).
2. `matrixAutoUpdate = false` on every static container and mesh, with a single manual `updateMatrix()` (`Objects.js:295-306`, `World/index.js:50`, `Floor.js:59`); static objects never get a body to mesh copy.
3. **Physics sleeping**: dynamic props are `sleep()`ed at creation and wake on contact (`Physics.js:650-655`).
4. **Primitive-only colliders** (box/cylinder/sphere) - no mesh colliders in cannon.
5. Flat background quad instead of a floor mesh + sky; `frustumCulled=false` on it (`Floor.js:58`).
6. Shadow quads are 1-quad geometries sharing one geometry (`Shadows.js:151`), and `uAlpha` hits 0 when far/tilted.
7. Blur pass skipped when strength == 0 (`Application.js:197-198`); blur only a 9-tap.
8. Raycasts only when the mouse moved: `mouse.needsUpdate` flag (`World/Areas.js:36-42,66-70`). Pan likewise (`Camera.js:310-325`).
9. `delta` clamped to 60 ms so a background tab doesn't explode the physics step (`Time.js:34`).
10. **Dead code**: a geometry-merge system (`Objects.merge`, `Objects.js:129-209`) exists but its call is commented out (`World/index.js:375-378`; grep shows no other caller), so the shipped site does *not* merge static meshes. PARTIAL on the draw-call count: not measured (would need `renderer.info`); each static piece is its own mesh.
11. **Pixel ratio forced to 2** (`Application.js:92`, the dynamic clamp is commented out on line 91), i.e. no adaptive resolution. Expensive on 4K; cheap here because the fragment shader is tiny.
12. Loads everything up front (single manifest) rather than streaming; world construction deferred to after START so main-thread work lands behind the user gesture.

---

## 11. UX hooks and delight

[SOURCE]
- **Physical UI.** Title letters, arrow-key instructions, bricks, bowling pins are all rigid bodies with collision SFX (`IntroSection.js:160-276`, `PlaygroundSection.js:125-213`). The first thing you do with the interface is break it.
- **Areas** (`World/Area.js`): translucent floor rectangle + animated "fence" shader (diagonal moving stripes, `shaders/areaFence/fragment.glsl:19-26`) that pops up with `back.out(3)` easing when the car is inside, plus a key icon floating over it ("ENTER"), click or Enter to activate: `window.open(link)` (`Project.js:197`, `InformationSection.js:126`). Interaction feedback is 3 layers: fence bounce (0.05 s down then `back.out(2)` 0.25 s), border alpha flash, `uiArea` sound (`Area.js:182-197`).
- **Projects as a drive-by gallery**: each project is a board with slide images + a floor texture + award trophies; the camera tilts and blur drops as you enter (`Project.js`, `ProjectsSection.js:395-412`).
- **Easter eggs** (`World/EasterEggs.js`): Konami code `Up Up Down Down Left Right Left Right (B A)` spawns `3^count` falling lemons (and a swipe-gesture version for touch) at a hidden spot (-60,-100) (lines 25-122); a "?" pad at (0,80) in Crossroads changes a random wig + random colour on the car (lines 181-300); `K` rains horns, and on `#cybertruck` `B` fires bowling balls at the car (`Car.js:312-346, 368-386`); URL hashes `#debug` (dat.GUI), `#cybertruck` (alt car, `Application.js:48-49`).
- **Third-party plug**: the Three.js Journey chat prompt, throttled by distance driven x times seen, with `localStorage` (`ThreejsJourney.js`) - a monetization CTA that waits until the user is engaged.
- **Dynamic tab title** (see section 7).
- Share surface: `index.html` og/twitter meta with a 1200x630 image (`static/social/`), theme colour `#ff8908`. The shareability comes from "drive and crash a name" being instantly screen-recordable, not from the meta tags. [GUESS on the causal claim]

---

## 12. Style DNA (brief for an artist)

| Axis | Spec |
|---|---|
| Ground | Full-screen gradient, 4 corners: `#f5883c` TL, `#ff9043` TR, `#fccf92` BR, `#f5aa58` BL (SOURCE `Floor.js:20-23`). Reads "hot orange top to pale apricot bottom-right". Pink haze `#ffcfe0` at 55% bottom-left (`Application.js:165-170`). |
| Shadow / bounce colour | `#d04500` (burnt orange) everywhere, never black (`Materials.js:46,184`; `Shadows.js:20`). Shadows are warm and soft, ~35-50% alpha. |
| Object palette (matcap midtones, sampled from the PNGs) | white `#e4e0df` (dominant, the "clay"), yellow `#f2e788`, orange `#eeac63`, red `#ee785f`, beige `#f1d6c4`, brown `#dca77c`, emerald `#88c6b3`, purple `#bc84bf`, blue `#848ac4`, gray `#9d9594`, black `#524a48` (soft, never pure), green(=lime-yellow) `#e9e97c`. Darkest rim of each is its own saturated hue (e.g. white's shadow side is `#d1ad9f`, pinkish). Sampled by a one-off script from `static/models/matcaps/*.png` (PARTIAL: 3 sample points per file). |
| Pure unlit | red `#ff0000`, white `#ffffff`, yellow `#ffe889` (brake / reverse lights, `Materials.js:33-38`). |
| Shape language | Chunky, low-poly, faceted-but-rounded toys: trees are tall yellow tapered prisms on stubby trunks, rocks are 6-10 face white lumps, bricks are rounded white blocks, letters are extruded bevelled sans. Everything slightly oversized to the car. No textures on objects; colour only via matcap. Reference: the trees/rocks in `RECON/screenshots/04`/`05`. |
| Lighting mood | Late-afternoon sun, no direct light, low-contrast: matcap gives soft top-left key, indirect orange bounce on lower faces, blob shadows offset to the upper right (sun at `(-2.5,-2.65,3.75)`). Colour temperature: everything warm; the only cool notes are small emerald/blue props. |
| Camera framing | 3/4 high-angle, FOV 40, direction `(1.135,-1.45,1.15)`, 14-29 units away, car roughly screen-centre (slightly high), always axis-aligned; ground fills the frame, no horizon, no sky. |
| Motion feel | Weighty but arcadey: spring-suspension car with whipping antenna, exponential camera ease (0.15), `back.out` overshoot on every UI pop (`Area.js:184,214`), 2 s `power1.inOut` camera/blur transitions. Nothing snaps; everything overshoots then settles. |
| Typography | Tilted-in-world italic condensed caps (labels are baked PNG alpha maps like "START", "USE YOUR ... KEYS TO MOVE AROUND", rendered as white decals on the ground, lying flat with the 3D perspective). DOM-side the only font is Comic Neue Bold for the ad bubble (`style/main.css:67`, `index.html`). |
| Sound feel | Dry, pitched-down wooden/plastic clacks, chunky thuds, a cartoon car horn, a single looping engine that rises in pitch; no music, no ambience. |
| UI | Zero HUD. All "UI" is diegetic floor rectangles, keycap meshes and white decals. |

---

## 13. Steal list for New Worlds

Our stack: vanilla three.js r187, `WebGPURenderer` + TSL, Rapier. Rubric (docs/TRACK.md): Creativity 45 / Technical complexity 25 / Presentation 30, hook in the first 15 s. "Hook" = presentation/15-second rule.

| # | Technique | Effort | Maps to our stack | Rubric criterion |
|---|---|---|---|---|
| 1 | **Loading screen = first object in the world**: loading progress drawn as a floor ring (angle mask), becomes the START pad, START click = audio unlock + world build | S | Render a single `Mesh` with a TSL `atan(x,y)` step mask (`areaFloorBorder/fragment.glsl:10-14`) before the heavy world loads. Build the rest after the click. | Presentation (hook), Creativity |
| 2 | **Radial rise-from-floor reveal** (vertex displace by `uReveal - dist/30`) | S | TSL `positionNode` on our toon/matcap node material: `positionLocal.z.sub(pow(...))`. A uniform driven by gsap. 15 lines. | Presentation (hook) |
| 3 | **Matcap + fake-bounce shading, no lights** | S-M | three has `MeshMatcapNodeMaterial` / TSL `matcapUV`; add his bounce term as a `mix(color, bounceColor, strength)` using `normalWorld` and `positionWorld`. Gives a cohesive look at a tiny GPU cost. | Creativity (style), Technical |
| 4 | **Blob-shadow quads along a fake sun vector** (with height fade and tilt fade) | M | Port `Shadows.js:62-97` almost verbatim; the shadow shader (`shadow/fragment.glsl`) becomes a TSL node on a shared `NodeMaterial`. Transparent + `depthWrite=false`. Consider InstancedMesh if >100 casters. | Technical, Creativity |
| 5 | **Baked `floorShadow.png` per static prop** | S (needs an asset step) | Same 4-liner in TSL; bake in Blender (AO to plane) or even generate procedurally from our own world data. | Creativity |
| 6 | **Screen-space gradient "ground"** via 2x2 DataTexture + fixed-direction camera | S | `scene.background = texture` or a full-screen quad in TSL (`positionGeometry.xy` to clip). Only valid if we keep the camera angle-locked. If our world needs a free camera, skip. | Creativity |
| 7 | **Tilt-shift blur masked by screen Y** that drops to 0 on "reading" zones | S | TSL post-processing (`PostProcessing`/`RenderPipeline` in r187 - confirm name): `gaussianBlur` node with `mix` by `1 - sin(uv.y * PI)`. Tween strength per zone. | Presentation, Technical |
| 8 | **Zone-triggered camera angle + blur transitions** (AABB test vs the player, gsap tween direction vector over 2 s) | S | Pure JS, engine-agnostic; port `Zones.js` + `Camera.angle.set`. Great for "arriving at a place" beats. | Presentation |
| 9 | **Exponential-follow camera with fixed angle + drag-pan that snaps back on movement** | S | Plain JS, no porting. | Presentation |
| 10 | **Two-file model convention + name-driven materials and colliders** (`base.glb`/`collision.glb`, `shadeX`, `cube/cylinder/sphere/center` names) | M | Rapier has `ColliderDesc.cuboid/cylinder/ball`; map by name, `cuboid(scale/2)`. Gives artists a zero-code workflow. Keep Draco/meshopt on glb. | Technical, speed of iteration |
| 11 | **RaycastVehicle car** (cannon 0.6 `RaycastVehicle`) | M | Rapier has `world.createVehicleController(chassisBody)` (`DynamicRayCastVehicleController`, PARTIAL: verify on our Rapier version). Re-tune: stiffness 50, travel 0.3, friction slip 10, low roll influence, all numbers in `Physics.js:121-149` are a good starting table. Self-righting + horn-jump (`Physics.js:367-396`) port as-is. | Technical, Creativity (verb = drive) |
| 12 | **Physical UI** (title letters, key hints, signposts as rigid bodies with collision SFX; sleeping until hit) | S-M | Rapier bodies with `sleeping` on; `COLLISION_EVENTS` + `ContactForceEvent` gives impact magnitude for velocity-mapped audio. | Creativity, Presentation |
| 13 | **Velocity-mapped, pitch-randomised one-shot SFX** (pitch down for heft; min-delta throttle) | S | Howler as-is, or WebAudio. 30 lines (`Sounds.js:307-333`). Highest delight-per-line in the project. | Presentation |
| 14 | **Single-loop engine** with rate and volume from speed/throttle (rise 0.3, fall 0.15) | S | Howler `rate()` or `AudioBufferSourceNode.playbackRate`. Generalises to any "the world hums with your motion" loop (wind, tone, synth). | Presentation |
| 15 | **Diegetic areas**: floor rect + animated stripe fence + floating key icon, `back.out` pop, sound, Enter to activate | M | The stripe shader (`areaFence/fragment.glsl`) is ~10 lines of TSL (`mod(x+y-time...)`). Reuse as "portal pads" into data views / new-world doors. | Creativity, Presentation |
| 16 | **Secondary motion for free**: spring-damped antenna / tail driven by acceleration | S | Plain JS (`Car.js:135-186`). | Presentation |
| 17 | **Tab title as a mini-game** (`____🚗__` moves with speed) | S | 10 lines of JS; reflect our own theme (a creature, a probe, a wave). Cheap shareability gag. | Presentation/Creativity |
| 18 | **Konami / hidden pad / URL-hash easter eggs** that change the world (lemon rain, wigs) | S | JS only. Pick 1-2 that fit the theme; announce none. | Creativity (discovery) |
| 19 | **Sleep + static-matrix optimisations**, delta clamp, raycast-only-on-move | S | Same flags: Rapier sleeping, `matrixAutoUpdate=false`, `Math.min(dt, 0.06)`. | Technical (fps bar) |
| 20 | **Delay the CTA/ad until the user has driven N units** (distance-gated prompt with localStorage backoff) | S | JS only; good pattern for our "demo QR / sponsor" moment at hour 20. | Presentation |
| 21 | **Procedural scatter from a weighted tile library** (`Tiles.js`, `Walls.js`) | S | JS only, instanced meshes if the count grows; weighted pick + jitter produce an organic "path". | Technical, Creativity |
| - | **Skip**: `cannon` 0.6 (ancient), `EffectComposer`, GLSL `ShaderMaterial` copies (rewrite as TSL), pixel-ratio-2 hard force (clamp to `min(dpr,2)` with a perf governor), the dead geometry-merge code. | - | - | - |

### Porting notes (GLSL/cannon to TSL/Rapier)
- GLSL strings to TSL nodes: matcap, shadow, floorShadow, area border/fence, glows and blur are all < 40 lines each; the only non-trivial one is the matcap vertex reveal (needs a custom `positionNode`). Don't copy the `#include <...>` chunks; use `NodeMaterial` built-ins.
- Axis: he is Z-up; we are likely Y-up. Either keep Z-up (set `camera.up`, set Rapier gravity on z) or swap on import; pick one on day 1 and put it in CLAUDE.md.
- Colour management: he manually `convertLinearToSRGB()`s hex colours and ends with `colorspace_fragment`. With r187 `ColorManagement` on, feed `new Color('#f5883c')` directly and **do not** re-convert; otherwise the orange will go washed out.
- cannon `getImpactVelocityAlongNormal()` has a Rapier equivalent in contact-force events (`totalForceMagnitude`) - scale differs, re-tune `velocityMultiplier`.
- Variable-step `world.step(dt)` (`Physics.js:30`) is fine for a demo but Rapier prefers a fixed step; use `world.timestep = 1/60` and an accumulator, interpolate meshes.

### What to *not* take away
- The pattern is "a small amount of authored fidelity everywhere", not scale. Our differentiator is the **theme** (New Worlds), not the driving; he already owns "drive a car around a portfolio". A direct car-on-orange-plane lookalike would score 3 on Creativity ("a judge could name three similar projects", docs/TRACK.md). Steal the *construction* (diegetic UI, physical text, lights-free look, loading-as-first-scene), apply to a different verb and a different data/idea.

---

## Evidence notes
- Screenshots captured with headless Chromium + swiftshader (software GL), so frame pacing and perf are not representative. Images: `RECON/screenshots/01-loading.png` (t=2 s, still loading), `02-start-screen.png` (START pad), `03-after-click.png`, `04-revealed-intro.png`, `05-driving.png`, `06-turning.png`.
- Not read in detail: `World/Sections/{Crossroads,Information,Playground,Distinction*}Section.js` beyond greps, `Geometries/*`, `Materials/AreaFence.js`, `ThreejsJourney.js` copy, the `.blend` files, `static/draco/*`. They add content, not new techniques. The live site (deployed build, may differ slightly from repo HEAD) was only checked visually.
