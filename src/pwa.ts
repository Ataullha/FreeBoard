export type OfflineState = 'preparing' | 'ready' | 'unavailable';
/** Retire only the removed app route; documents and all asset caches are untouched. */
export async function retireLegacyRoute(
  container: Pick<ServiceWorkerContainer, 'getRegistration'>,
  origin: string,
): Promise<boolean> {
  try {
    const scope = new URL('/FreePod/', origin).href;
    const registration = await container.getRegistration(scope);
    return registration?.scope === scope
      ? await registration.unregister()
      : false;
  } catch {
    return false;
  }
}
export function setupPwa(
  onState: (state: OfflineState) => void,
  onUpdate: (apply: () => void) => void,
) {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    onState('unavailable');
    return;
  }
  // A previously installed old-route worker must not keep redirecting a removed URL.
  if (
    new URL(import.meta.env.BASE_URL, window.location.href).pathname ===
    '/FreeBoard/'
  )
    void retireLegacyRoute(navigator.serviceWorker, window.location.origin);
  let cancelled = false;
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .then((reg) => {
      if (cancelled) return;
      const announce = () => {
        if (reg.waiting)
          onUpdate(() => reg.waiting?.postMessage({ type: 'ACTIVATE_UPDATE' }));
      };
      if (reg.active) onState('ready');
      announce();
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') {
            if (navigator.serviceWorker.controller) announce();
            else onState('ready');
          }
          if (worker.state === 'redundant' && !reg.active)
            onState('unavailable');
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!cancelled) onState('ready');
      });
      void navigator.serviceWorker.ready.then(() => {
        if (!cancelled) onState('ready');
      });
    })
    .catch(() => onState('unavailable'));
  return () => {
    cancelled = true;
  };
}
