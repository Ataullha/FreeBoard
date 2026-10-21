export type OfflineState = 'preparing' | 'ready' | 'unavailable';
export function setupPwa(
  onState: (state: OfflineState) => void,
  onUpdate: (apply: () => void) => void,
) {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    onState('unavailable');
    return;
  }
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
