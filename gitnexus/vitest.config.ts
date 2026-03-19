import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Shared settings — inherited by all projects via extends: true
    globalSetup: ['test/global-setup.ts'],
    testTimeout: 30000,
    hookTimeout: 120000,
    pool: 'forks',
    globals: true,
    teardownTimeout: 3000,
    // N-API destructors can crash worker forks on macOS during process exit.
    // This is independent of the QueryResult lifetime fix in @ladybugdb/core 0.15.2 —
    // it's a vitest forks + native addon interaction where destructors run in
    // arbitrary order at exit. Tests themselves pass; only the exit crashes.
    // TODO: remove once LadybugDB fixes all N-API destructor ordering issues.
    dangerouslyIgnoreUnhandledErrors: true,

    // Coverage stays at root (not supported in project configs)
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/cli/index.ts',          // CLI entry point (commander wiring)
        'src/server/**',              // HTTP server (requires network)
        'src/core/wiki/**',           // Wiki generation (requires LLM)
      ],
      // Auto-ratchet: vitest bumps thresholds when coverage exceeds them.
      // CI will fail if a PR drops below these floors.
      thresholds: {
        statements: 26,
        branches: 23,
        functions: 28,
        lines: 27,
        autoUpdate: true,
      },
    },

    // LadybugDB's native mmap addon causes file-lock conflicts when vitest
    // runs lbug test files in parallel forks on Windows.  The 'lbug-db'
    // project forces sequential execution in a single fork.
    //
    // isolate: false keeps all 8 files in one fork process — the fork only
    // exits once after all files complete, avoiding repeated N-API destructor
    // crashes on macOS that kill the worker between files.  Module state
    // (ftsLoaded, adapter connections) persists across files, which is safe
    // because each file clears/reseeds data via withTestLbugDB.
    projects: [
      {
        extends: true,
        test: {
          name: 'lbug-db',
          include: [
            'test/integration/lbug-core-adapter.test.ts',
            'test/integration/lbug-pool.test.ts',
            'test/integration/lbug-pool-stability.test.ts',
            'test/integration/local-backend.test.ts',
            'test/integration/local-backend-calltool.test.ts',
            'test/integration/search-core.test.ts',
            'test/integration/search-pool.test.ts',
            'test/integration/augmentation.test.ts',
          ],
          fileParallelism: false,
          isolate: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'default',
          include: ['test/**/*.test.ts'],
          exclude: [
            'test/integration/lbug-core-adapter.test.ts',
            'test/integration/lbug-pool.test.ts',
            'test/integration/lbug-pool-stability.test.ts',
            'test/integration/local-backend.test.ts',
            'test/integration/local-backend-calltool.test.ts',
            'test/integration/search-core.test.ts',
            'test/integration/search-pool.test.ts',
            'test/integration/augmentation.test.ts',
          ],
        },
      },
    ],
  },
});
