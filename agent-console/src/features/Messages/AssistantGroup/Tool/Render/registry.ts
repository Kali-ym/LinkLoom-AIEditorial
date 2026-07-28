import type { BuiltinRender, BuiltinRenderRegistryEntry } from '../toolComponentTypes';

type RegistryImpl = typeof import('./registryImpl');

let impl: RegistryImpl | null = null;
let loadPromise: Promise<RegistryImpl> | null = null;

/** Dynamically load the heavy tool-render registry chunk. */
export function loadBuiltinRenderRegistry(): Promise<RegistryImpl> {
  if (!loadPromise) {
    loadPromise = import('./registryImpl').then((mod) => {
      impl = mod;
      return mod;
    });
  }
  return loadPromise;
}

function schedulePreload(): void {
  const start = () => {
    void loadBuiltinRenderRegistry();
  };
  if (typeof window === 'undefined') return;
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(start, { timeout: 5_000 });
  } else {
    window.setTimeout(start, 2_000);
  }
}

schedulePreload();

export function getBuiltinRender(
  identifier?: string,
  apiName?: string,
): BuiltinRender | undefined {
  return impl?.getBuiltinRender(identifier, apiName);
}

/**
 * Until the registry chunk loads, assume a render may exist so CustomRender can
 * resolve it asynchronously. After load, defer to the real registry.
 */
export function hasBuiltinRender(identifier?: string, apiName?: string): boolean {
  if (!identifier || !apiName) return false;
  if (impl) return impl.hasBuiltinRender(identifier, apiName);
  void loadBuiltinRenderRegistry();
  return true;
}

export function listBuiltinRenderEntries(): BuiltinRenderRegistryEntry[] {
  return impl?.listBuiltinRenderEntries() ?? [];
}

export function getRenderRegistryIdentifiers(): RegistryImpl['RENDER_REGISTRY_IDENTIFIERS'] | null {
  return impl?.RENDER_REGISTRY_IDENTIFIERS ?? null;
}
