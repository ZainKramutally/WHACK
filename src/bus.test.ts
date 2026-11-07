import { describe, expect, it, vi } from 'vitest';
import { createBus } from './bus';

describe('bus', () => {
  it('delivers payloads to listeners of that type only', () => {
    const b = createBus();
    const a = vi.fn();
    const c = vi.fn();
    b.on('build:life', a);
    b.on('build:complete', c);
    b.emit('build:life', { worldId: 'carbon' });
    expect(a).toHaveBeenCalledWith({ worldId: 'carbon' });
    expect(c).not.toHaveBeenCalled();
  });

  it('off removes exactly that listener', () => {
    const b = createBus();
    const a = vi.fn();
    const c = vi.fn();
    b.on('build:life', a);
    b.on('build:life', c);
    b.off('build:life', a);
    b.emit('build:life', { worldId: 'silicon' });
    expect(a).not.toHaveBeenCalled();
    expect(c).toHaveBeenCalledOnce();
  });

  it('emit with no listeners, and off of an unknown listener, are no-ops', () => {
    const b = createBus();
    expect(() => b.emit('inspect:close', {})).not.toThrow();
    expect(() => b.off('inspect:close', () => {})).not.toThrow();
  });

  it('a listener removing itself during emit does not skip others', () => {
    const b = createBus();
    const second = vi.fn();
    const first = () => b.off('build:life', first);
    b.on('build:life', first);
    b.on('build:life', second);
    b.emit('build:life', { worldId: 'carbon' });
    expect(second).toHaveBeenCalledOnce();
  });
});
