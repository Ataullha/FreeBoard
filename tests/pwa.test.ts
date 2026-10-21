import { describe, expect, it, vi } from 'vitest';
import { retireLegacyRoute } from '../src/pwa';
describe('retired route worker cleanup', () => {
  it('unregisters the exact obsolete scope without touching document data', async () => {
    const unregister = vi.fn().mockResolvedValue(true),
      getRegistration = vi.fn().mockResolvedValue({
        scope: 'https://example.test/FreePod/',
        unregister,
      });
    expect(
      await retireLegacyRoute({ getRegistration }, 'https://example.test'),
    ).toBe(true);
    expect(getRegistration).toHaveBeenCalledWith(
      'https://example.test/FreePod/',
    );
    expect(unregister).toHaveBeenCalledTimes(1);
  });
  it.each([
    'https://example.test/',
    'https://example.test/FreeBoard/',
    'https://example.test/FreePod/child/',
  ])('retains an unrelated worker at %s', async (scope) => {
    const unregister = vi.fn(),
      getRegistration = vi.fn().mockResolvedValue({ scope, unregister });
    expect(
      await retireLegacyRoute({ getRegistration }, 'https://example.test'),
    ).toBe(false);
    expect(unregister).not.toHaveBeenCalled();
  });
  it('does not interrupt the app when no old worker exists or lookup fails', async () => {
    expect(
      await retireLegacyRoute(
        { getRegistration: vi.fn().mockResolvedValue(undefined) },
        'https://example.test',
      ),
    ).toBe(false);
    expect(
      await retireLegacyRoute(
        {
          getRegistration: vi.fn().mockRejectedValue(new Error('Unavailable')),
        },
        'https://example.test',
      ),
    ).toBe(false);
  });
});
