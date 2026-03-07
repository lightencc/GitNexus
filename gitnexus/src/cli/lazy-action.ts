export type LazyModule = Record<string, unknown>;

export function createLazyAction<TArgs extends unknown[], TResult>(
  loader: () => Promise<LazyModule>,
  exportName: string,
) {
  return async (...args: TArgs): Promise<TResult> => {
    const module = await loader();
    const action = module[exportName];
    if (typeof action !== 'function') {
      throw new Error(`Lazy action export not found: ${exportName}`);
    }
    return action(...args);
  };
}
