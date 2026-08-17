import { defineConfig } from 'vitest/config';

// Kept apart from `vite.config.ts` on purpose. That file sets `root` to `web`, which is right for
// serving and building the site, but it would send the test runner looking for test files inside
// `web` alone. The tests of the build itself live in `build`.
export default defineConfig({
	test: {
		root: '.',
		include: ['build/**/*.test.ts', 'web/**/*.test.ts'],
	},
});
