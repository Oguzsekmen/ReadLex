import { App } from '@capacitor/app';
import { getAppPlatform, AppPlatform } from './platform';

export type NativeListenerHandle = { remove: () => Promise<void> | void };

export interface NativeAppBridge {
  addBackButtonListener(listener: () => void): Promise<NativeListenerHandle>;
  addAppStateListener(listener: (active: boolean) => void): Promise<NativeListenerHandle>;
  exitApp(): Promise<void>;
}

export interface NativeAppLifecycleCallbacks {
  /** Return true only when an in-app screen or overlay handled Android Back. */
  onBackButton: () => boolean | Promise<boolean>;
  onAppStateChange: (active: boolean) => void;
}

export type NativeBackHandler = () => boolean | Promise<boolean>;

type RegisteredBackHandler = { id: number; priority: number; handler: NativeBackHandler };

/**
 * Keeps back policy in one ordered registry. UI surfaces register intent only;
 * the Capacitor listener itself remains centralized at the application root.
 */
export class NativeBackCoordinator {
  private nextId = 0;
  private handlers = new Map<number, RegisteredBackHandler>();

  register(handler: NativeBackHandler, priority = 0): () => void {
    const id = ++this.nextId;
    this.handlers.set(id, { id, priority, handler });
    return () => this.handlers.delete(id);
  }

  async dispatch(): Promise<boolean> {
    const handlers = [...this.handlers.values()].sort((left, right) => right.priority - left.priority || right.id - left.id);
    for (const entry of handlers) {
      if (await entry.handler()) return true;
    }
    return false;
  }
}

/** Suppresses duplicate native state notifications without using browser time. */
export class NativeAppStateTransitionGuard {
  private active = true;

  transition(active: boolean): 'background' | 'foreground' | 'unchanged' {
    if (active === this.active) return 'unchanged';
    this.active = active;
    return active ? 'foreground' : 'background';
  }
}

const capacitorAppBridge: NativeAppBridge = {
  addBackButtonListener: (listener) => App.addListener('backButton', listener),
  addAppStateListener: (listener) => App.addListener('appStateChange', state => listener(state.isActive)),
  exitApp: () => App.exitApp()
};

export class NativeAppLifecycle {
  constructor(
    private readonly bridge: NativeAppBridge = capacitorAppBridge,
    private readonly platform: () => AppPlatform = getAppPlatform
  ) {}

  /**
   * Web intentionally registers nothing: browser history stays browser-owned.
   * Android owns Back; both native platforms can report foreground/background.
   */
  async subscribe(callbacks: NativeAppLifecycleCallbacks): Promise<() => Promise<void>> {
    const platform = this.platform();
    if (platform === 'web') return async () => undefined;

    let disposed = false;
    const handles: NativeListenerHandle[] = [];
    const remember = async (promise: Promise<NativeListenerHandle>) => {
      const handle = await promise;
      if (disposed) await handle.remove();
      else handles.push(handle);
    };

    await remember(this.bridge.addAppStateListener(active => {
      if (!disposed) callbacks.onAppStateChange(active);
    }));

    if (platform === 'android') {
      await remember(this.bridge.addBackButtonListener(() => {
        void Promise.resolve(callbacks.onBackButton()).then(handled => {
          if (!disposed && !handled) return this.bridge.exitApp();
          return undefined;
        }).catch(() => undefined);
      }));
    }

    return async () => {
      if (disposed) return;
      disposed = true;
      await Promise.all(handles.map(handle => Promise.resolve(handle.remove()).catch(() => undefined)));
    };
  }
}

