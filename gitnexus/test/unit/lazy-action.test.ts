import { describe, expect, it, vi } from 'vitest';
import { createLazyAction } from '../../src/cli/lazy-action.js';

describe('createLazyAction', () => {
  it('does not import target module until invoked', async () => {
    const loader = vi.fn(async () => ({
      run: vi.fn(async () => 'ok'),
    }));

    const action = createLazyAction(loader, 'run');

    expect(loader).not.toHaveBeenCalled();
    await expect(action('arg-1')).resolves.toBe('ok');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error when export is missing', async () => {
    const action = createLazyAction(async () => ({}), 'missing');
    await expect(action()).rejects.toThrow('missing');
  });
});
