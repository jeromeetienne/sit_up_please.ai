import { defineConfig } from 'vite';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Copies the MediaPipe runtime files into the extension build. */
function copyMediaPipeWasm(): Plugin {
	return {
		name: 'copy-mediapipe-wasm',
		writeBundle() {
			const source = resolve(process.cwd(), 'node_modules/@mediapipe/tasks-vision/wasm');
			const target = resolve(process.cwd(), 'contribs/chrome_ext/dist/wasm');
			mkdirSync(target, { recursive: true });
			cpSync(source, target, { recursive: true });
		},
	};
}

/** Builds the extension monitor page while reusing the main website source. */
export default defineConfig({
  root: resolve(process.cwd(), 'contribs/chrome_ext'),
  base: './',
  publicDir: resolve(process.cwd(), 'contribs/chrome_ext/public'),
  build: {
    outDir: resolve(process.cwd(), 'contribs/chrome_ext/dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        monitor: resolve(process.cwd(), 'contribs/chrome_ext/monitor.html'),
      },
    },
  },
  plugins: [copyMediaPipeWasm()],
});
