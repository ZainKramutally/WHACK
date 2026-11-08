import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { UNDERWATER_FX_ROOT, createUnderwaterFx, SHAFT_COUNT, SNOW_COUNT, floraDensityAt, fxState, waterHaze } from './underwaterFx';
import { seaStyle, waterAtDepth } from './palette';

const wet = { submersion: 1, nitrogen: false, light: 1, depth: 3, floraDensity: 0.5 };

describe('fxState', () => {
  it('is off above water and on below it', () => {
    expect(fxState({ ...wet, submersion: 0 })).toEqual({ on: false, shaft: 0, snow: 0 });
    const s = fxState(wet);
    expect(s.on).toBe(true);
    expect(s.shaft).toBeGreaterThan(0);
    expect(s.snow).toBeGreaterThan(0);
  });
  it('eases with submersion', () => {
    expect(fxState({ ...wet, submersion: 0.5 }).shaft).toBeLessThan(fxState(wet).shaft);
  });
  it('dims with depth and grows with life', () => {
    expect(fxState({ ...wet, depth: 60 }).shaft).toBeLessThan(fxState(wet).shaft);
    expect(fxState({ ...wet, floraDensity: 1 }).snow).toBeGreaterThan(fxState({ ...wet, floraDensity: 0 }).snow);
  });
  it('liquid nitrogen under 1% light is much fainter', () => {
    const si = fxState({ ...wet, nitrogen: true, light: 0.01 });
    const c = fxState(wet);
    expect(si.shaft).toBeLessThan(c.shaft * 0.15);
    expect(si.snow).toBeLessThan(c.snow * 0.5);
  });
  it('stays within the draw and vertex budget', () => {
    expect(SNOW_COUNT).toBeLessThanOrEqual(4000);
    expect(SHAFT_COUNT).toBeLessThanOrEqual(12);
  });
});

describe('haze', () => {
  it('water fog reaches tall forms at tens of metres', () => {
    const far = seaStyle('Water', false, false).underwaterFar;
    expect(far / 3).toBeGreaterThanOrEqual(30);
    expect(far / 3).toBeLessThanOrEqual(60);
  });
  it('darkens toward the water ramp deep colour with depth', () => {
    const base = new THREE.Color(seaStyle('Water', false, false).underwater);
    const shallow = waterHaze(new THREE.Color(), base, 0).getHex();
    const deep = waterHaze(new THREE.Color(), base, 200).getHSL({ h: 0, s: 0, l: 0 }).l;
    expect(shallow).toBe(base.getHex());
    expect(deep).toBeLessThan(base.getHSL({ h: 0, s: 0, l: 0 }).l);
    const target = new THREE.Color(waterAtDepth(60)).multiplyScalar(0.8);
    expect(Math.abs(deep - target.getHSL({ h: 0, s: 0, l: 0 }).l)).toBeLessThan(0.05);
  });
});

describe('floraDensityAt', () => {
  it('reads the cell under the camera and is 0 off the grid', () => {
    const f = new Float32Array(64 * 64 * 2);
    f[(32 * 64 + 32) * 2] = 0.5;
    expect(floraDensityAt(f, 1, 1, 256)).toBeCloseTo(0.5);
    expect(floraDensityAt(f, 1000, 0, 256)).toBe(0);
  });
});

describe('createUnderwaterFx', () => {
  it('puts its meshes under a named root for warmFeatures', () => {
    const scene = new THREE.Scene();
    const part = createUnderwaterFx({ scene, camera: new THREE.PerspectiveCamera() } as never);
    const root = scene.getObjectByName('underwaterFx');
    expect(UNDERWATER_FX_ROOT).toBe('underwaterFx');
    expect(root).toBeTruthy();
    expect(root!.children.length).toBe(part.meshes.length);
    expect(part.meshes.every((m) => !m.visible)).toBe(true);
  });
});
