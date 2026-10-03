import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { NativeAppLifecycle, NativeBackCoordinator, NativeBackHandler } from '../services/native/appLifecycle';

type RegisterNativeBackHandler = (handler: NativeBackHandler, priority?: number) => () => void;

export const NativeBackHandlerContext = createContext<RegisterNativeBackHandler | undefined>(undefined);

const defaultLifecycle = new NativeAppLifecycle();

export const useNativeAppLifecycle = ({
  onRootBack,
  onAppStateChange,
  lifecycle = defaultLifecycle
}: {
  onRootBack: NativeBackHandler;
  onAppStateChange: (active: boolean) => void;
  lifecycle?: NativeAppLifecycle;
}): RegisterNativeBackHandler => {
  const coordinator = useRef(new NativeBackCoordinator());
  const rootBack = useRef(onRootBack);
  const appState = useRef(onAppStateChange);

  useEffect(() => { rootBack.current = onRootBack; }, [onRootBack]);
  useEffect(() => { appState.current = onAppStateChange; }, [onAppStateChange]);

  const register = useCallback<RegisterNativeBackHandler>((handler, priority) => coordinator.current.register(handler, priority), []);

  useEffect(() => {
    let disposed = false;
    let remove: (() => Promise<void>) | undefined;
    void lifecycle.subscribe({
      onBackButton: () => coordinator.current.dispatch().then(handled => handled || rootBack.current()),
      onAppStateChange: active => appState.current(active)
    }).then(cleanup => {
      if (disposed) void cleanup();
      else remove = cleanup;
    }).catch(() => undefined);
    return () => {
      disposed = true;
      if (remove) void remove();
    };
  }, [lifecycle]);

  return register;
};

/** Registers a transient UI action without letting components bind native APIs. */
export const useNativeBackHandler = (handler: NativeBackHandler, priority = 100, enabled = true): void => {
  const register = useContext(NativeBackHandlerContext);
  const latest = useRef(handler);
  useEffect(() => { latest.current = handler; }, [handler]);
  useEffect(() => {
    if (!register || !enabled) return;
    return register(() => latest.current(), priority);
  }, [enabled, priority, register]);
};

