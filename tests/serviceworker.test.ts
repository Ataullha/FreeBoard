// @vitest-environment node
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, it, expect } from 'vitest';
const scope = 'https://freeboard.example/';
async function worker(
  assets = [
    './index.html',
    './assets/editor.js',
    './excalidraw/fonts/font.woff2',
  ],
) {
  const listeners: Record<string, (e: unknown) => void> = {},
    stored = new Map<string, Map<string, Response>>();
  let offline = false,
    skipped = 0,
    clients = 1;
  const key = (req: unknown) => {
    const value =
      typeof req === 'string'
        ? req
        : req instanceof URL
          ? req.href
          : (req as { url: string }).url;
    const u = new URL(value, scope);
    u.search = '';
    return u.href;
  };
  const fetch = async (req: unknown) => {
    if (offline) throw new TypeError('Offline');
    return new Response(`cached:${key(req)}`);
  };
  const caches = {
    async open(name: string) {
      if (!stored.has(name)) stored.set(name, new Map());
      const data = stored.get(name)!;
      return {
        async addAll(urls: string[]) {
          for (const url of urls) data.set(key(url), await fetch(url));
        },
        async match(req: unknown) {
          return data.get(key(req));
        },
      };
    },
    async keys() {
      return [...stored.keys()];
    },
    async delete(name: string) {
      return stored.delete(name);
    },
    async match(req: unknown) {
      for (const map of stored.values()) {
        const hit = map.get(key(req));
        if (hit) return hit;
      }
      return undefined;
    },
  };
  const self = {
    location: new URL(scope + 'sw.js'),
    registration: { scope },
    addEventListener(name: string, fn: (e: unknown) => void) {
      listeners[name] = fn;
    },
    skipWaiting() {
      skipped++;
    },
    clients: {
      async claim() {},
      async matchAll() {
        return Array.from({ length: clients });
      },
    },
  };
  const source = (
    await readFile(
      new URL('../scripts/sw-template.js', import.meta.url),
      'utf8',
    )
  )
    .replace('__CACHE__', JSON.stringify('freeboard-test'))
    .replace('__ASSETS__', JSON.stringify(assets));
  vm.runInNewContext(source, { self, caches, URL, fetch });
  const lifecycle = async (name: string) => {
    let done: Promise<void> = Promise.resolve();
    listeners[name]({
      waitUntil(p: Promise<void>) {
        done = p;
      },
    });
    await done;
  };
  const request = async (url: string, mode = 'cors') => {
    let response: Promise<Response> | undefined;
    listeners.fetch({
      request: { method: 'GET', url, mode },
      respondWith(p: Promise<Response>) {
        response = p;
      },
    });
    return response ? await response : undefined;
  };
  return {
    stored,
    caches,
    lifecycle,
    request,
    message: (data: unknown) => listeners.message({ data }),
    setOffline() {
      offline = true;
    },
    setClients(n: number) {
      clients = n;
    },
    get skipped() {
      return skipped;
    },
  };
}
describe('offline worker and safe updates', () => {
  it('precaches runtime files, then serves the app, fonts, and chunks without network', async () => {
    const w = await worker();
    await w.lifecycle('install');
    w.setOffline();
    expect(
      await (await w.request(scope + 'assets/editor.js'))!.text(),
    ).toContain('cached:');
    expect(
      await (await w.request(scope + 'excalidraw/fonts/font.woff2'))!.text(),
    ).toContain('font.woff2');
    expect(
      await (await w.request(scope + 'unknown-route', 'navigate'))!.text(),
    ).toContain('index.html');
  });
  it('does not activate updates until explicitly requested', async () => {
    const w = await worker();
    await w.lifecycle('install');
    expect(w.skipped).toBe(0);
    w.message({ type: 'OTHER' });
    expect(w.skipped).toBe(0);
    w.message({ type: 'ACTIVATE_UPDATE' });
    expect(w.skipped).toBe(1);
  });
  it.each(['freeboard-older', 'boardpilot-older'])(
    'keeps %s chunks while multiple tabs remain open',
    async (cacheName) => {
      const w = await worker();
      const old = await w.caches.open(cacheName);
      await old.addAll(['./assets/old-editor.js']);
      await w.lifecycle('install');
      w.setClients(2);
      await w.lifecycle('activate');
      w.setOffline();
      expect(
        await (await w.request(scope + 'assets/old-editor.js'))!.text(),
      ).toContain('old-editor.js');
      expect(w.stored.has(cacheName)).toBe(true);
      w.setClients(1);
      await w.lifecycle('activate');
      expect(w.stored.has(cacheName)).toBe(false);
    },
  );
  it('does not intercept cross-origin requests', async () => {
    const w = await worker();
    expect(await w.request('https://elsewhere.example/')).toBeUndefined();
  });
  it('fails installation when its required assets cannot be cached', async () => {
    const w = await worker();
    w.setOffline();
    await expect(w.lifecycle('install')).rejects.toThrow('Offline');
    expect(w.skipped).toBe(0);
  });
});
