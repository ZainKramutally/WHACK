import { describe, expect, it } from 'vitest';
import { captureName, needFallbackFrame, pickMime, recClock, stamp } from './capture';

describe('capture helpers', () => {
  const d = new Date(2026, 10, 8, 9, 5, 7);
  it('stamps local time as yyyymmdd-hhmmss', () => expect(stamp(d)).toBe('20261108-090507'));
  it('names files by world, seed and time, with safe fallbacks', () => {
    expect(captureName('silicon', 42, d, 'png')).toBe('life-silicon-42-20261108-090507.png');
    expect(captureName(undefined, undefined, d, 'webm')).toBe('life-menu-0-20261108-090507.webm');
    expect(captureName('a b/c', 1, d, 'png')).toBe('life-a-b-c-1-20261108-090507.png');
  });
  it('picks the best supported mime, or undefined', () => {
    expect(pickMime(() => true)).toBe('video/webm;codecs=vp9,opus');
    expect(pickMime((t) => t === 'video/webm;codecs=vp8')).toBe('video/webm;codecs=vp8');
    expect(pickMime(() => false)).toBeUndefined();
  });
  it('formats the REC clock', () => {
    expect(recClock(12.9)).toBe('0:12');
    expect(recClock(125)).toBe('2:05');
  });
  it('asks for a timer frame only when the render loop has gone quiet', () => {
    expect(needFallbackFrame(1000, 950)).toBe(false);
    expect(needFallbackFrame(1000, 800)).toBe(true);
  });
});
