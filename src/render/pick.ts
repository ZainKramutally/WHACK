// Click-to-inspect picking: a screen point (or the gamepad reticle at screen centre) → InspectTarget.
// Organisms by bounding sphere (→ organism id), then the terrain ray: sea, ground, producer (flora cell under the hit)
// or sky. Emits `inspect:open` with the screen position for the card. Read-only.
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { Bus } from '../bus';
import type { InspectTarget, VisualInputs } from '../worlds/types';
import type { FaunaPart } from './fauna';
import type { FloraPart } from './flora';
import { cellCentre, marchRay } from './layout';

export interface PickerDeps {
  app: App;
  bus: Bus;
  fauna: FaunaPart;
  flora: FloraPart;
  getInputs: () => VisualInputs;
  getPatch: () => number;
}

/** A target's vertical extent in the world, for the hover lock: base centre, height and half-width (m). */
export interface PickBounds { x: number; y: number; z: number; height: number; radius: number }
export interface PickResult { target: InspectTarget; at: { x: number; y: number }; bounds?: PickBounds }

export interface Picker {
  /** Pick at client pixels or the screen centre; emits inspect:open and returns the target. */
  pick(at: { x: number; y: number } | 'reticle'): InspectTarget;
  /** Pick without emitting (for tests and hover). */
  resolve(at: { x: number; y: number } | 'reticle'): PickResult;
}

export function createPicker(deps: PickerDeps): Picker {
  const { app, bus, fauna, flora } = deps;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function resolve(at: { x: number; y: number } | 'reticle'): PickResult {
    const rect = app.renderer.domElement.getBoundingClientRect();
    const sx = at === 'reticle' ? rect.left + rect.width / 2 : at.x;
    const sy = at === 'reticle' ? rect.top + rect.height / 2 : at.y;
    ndc.set(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
    app.camera.updateMatrixWorld();
    ray.setFromCamera(ndc, app.camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    const inputs = deps.getInputs();
    const patch = deps.getPatch();
    const seaVisible = (inputs.stats.seaCover ?? 1) > 0.005;

    const world = marchRay(o, d, {
      maxDist: patch * 1.5, step: Math.max(0.5, patch / 400), patch,
      heightAt: inputs.terrain.height, seaLevel: inputs.seaLevel, seaVisible, flora: inputs.flora,
    });
    let target = world.target;
    if (target.kind === 'sky' && seaVisible && o.y < inputs.seaLevel && d.y > 0) target = { kind: 'sea' }; // looking up from underwater
    const org = fauna.hit(o, d);
    const plant = flora.hit(o, d);
    let bounds: PickBounds | undefined;
    let best = world.dist;
    // Nearest of the organism, the drawn plant and the terrain march wins (a creature in front of a plant wins).
    if (plant && plant.dist <= best) {
      best = plant.dist;
      target = { kind: 'producer', cell: plant.cell };
      bounds = { x: plant.x, y: plant.y, z: plant.z, height: plant.height, radius: plant.radius };
    }
    // Water is clear: a creature seen through the sea surface (swimmers, from above) beats the sea hit, not the ground.
    if (org && (org.dist <= best || world.target.kind === 'sea')) {
      target = { kind: 'organism', organismId: org.id };
      const l = fauna.locate(org.id);
      bounds = l ? { x: l.x, y: l.y - l.radius, z: l.z, height: 2 * l.radius, radius: l.radius } : undefined;
    }
    if (target.kind === 'producer' && !bounds) {
      const c = cellCentre(target.cell, patch);
      bounds = { x: c.x, y: inputs.terrain.height(c.x, c.z), z: c.z, height: 1, radius: patch / 128 };
    }
    return { target, at: { x: sx, y: sy }, bounds };
  }

  return {
    resolve,
    pick(at) {
      const r = resolve(at);
      bus.emit('inspect:open', { target: r.target, at: r.at });
      return r.target;
    },
  };
}
