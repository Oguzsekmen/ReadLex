import { describe, expect, it } from 'vitest';
import { NativeAppBridge, NativeAppLifecycle, NativeAppStateTransitionGuard, NativeBackCoordinator, NativeListenerHandle } from '../services/native/appLifecycle';

type FakeBridge = NativeAppBridge & {
  backListeners: Array<() => void>;
  stateListeners: Array<(active: boolean) => void>;
  removed: number;
  exits: number;
};

const createBridge = (): FakeBridge => {
  const bridge: FakeBridge = {
    backListeners: [], stateListeners: [], removed: 0, exits: 0,
    addBackButtonListener: async listener => {
      bridge.backListeners.push(listener);
      return { remove: () => { bridge.removed += 1; } } satisfies NativeListenerHandle;
    },
    addAppStateListener: async listener => {
      bridge.stateListeners.push(listener);
      return { remove: () => { bridge.removed += 1; } } satisfies NativeListenerHandle;
    },
    exitApp: async () => { bridge.exits += 1; }
  };
  return bridge;
};

describe('native lifecycle bridge', () => {
  it('is a web no-op and leaves browser navigation untouched', async () => {
    const bridge = createBridge();
    const remove = await new NativeAppLifecycle(bridge, () => 'web').subscribe({
      onBackButton: () => true,
      onAppStateChange: () => undefined
    });
    expect(bridge.backListeners).toHaveLength(0);
    expect(bridge.stateListeners).toHaveLength(0);
    await remove();
  });

  it('gives overlays priority, navigates nested views once, then exits only at root', async () => {
    const bridge = createBridge();
    const coordinator = new NativeBackCoordinator();
    const order: string[] = [];
    const removeOverlay = coordinator.register(() => { order.push('overlay'); return true; }, 300);
    coordinator.register(() => { order.push('reader'); return true; }, 10);
    const remove = await new NativeAppLifecycle(bridge, () => 'android').subscribe({
      onBackButton: () => coordinator.dispatch(),
      onAppStateChange: () => undefined
    });

    bridge.backListeners[0]();
    await Promise.resolve();
    expect(order).toEqual(['overlay']);
    expect(bridge.exits).toBe(0);

    removeOverlay();
    bridge.backListeners[0]();
    await Promise.resolve();
    expect(order).toEqual(['overlay', 'reader']);

    const rootCoordinator = new NativeBackCoordinator();
    const rootRemove = await new NativeAppLifecycle(bridge, () => 'android').subscribe({
      onBackButton: () => rootCoordinator.dispatch(),
      onAppStateChange: () => undefined
    });
    bridge.backListeners[1]();
    await Promise.resolve();
    expect(bridge.exits).toBe(1);
    await remove();
    await rootRemove();
  });

  it('forwards lifecycle state without changing auth and cleans listeners on unmount', async () => {
    const bridge = createBridge();
    const state: boolean[] = [];
    const remove = await new NativeAppLifecycle(bridge, () => 'ios').subscribe({
      onBackButton: () => false,
      onAppStateChange: active => state.push(active)
    });
    expect(bridge.backListeners).toHaveLength(0);
    bridge.stateListeners[0](false);
    bridge.stateListeners[0](true);
    expect(state).toEqual([false, true]);
    await remove();
    expect(bridge.removed).toBe(1);
    bridge.stateListeners[0](false);
    expect(state).toEqual([false, true]);
  });

  it('flushes only on a real background transition and refreshes once on each foreground transition', () => {
    const guard = new NativeAppStateTransitionGuard();
    const transitions = [true, false, false, true, true, false, true].map(value => guard.transition(value));
    expect(transitions).toEqual(['unchanged', 'background', 'unchanged', 'foreground', 'unchanged', 'background', 'foreground']);
    expect(transitions.filter(value => value === 'background')).toHaveLength(2);
    expect(transitions.filter(value => value === 'foreground')).toHaveLength(2);
  });

  it('uses each registered handler once, avoiding duplicate navigation after replacement', async () => {
    const coordinator = new NativeBackCoordinator();
    let oldCalls = 0;
    const unregister = coordinator.register(() => { oldCalls += 1; return true; });
    unregister();
    let newCalls = 0;
    coordinator.register(() => { newCalls += 1; return true; });
    expect(await coordinator.dispatch()).toBe(true);
    expect(oldCalls).toBe(0);
    expect(newCalls).toBe(1);
  });
});

