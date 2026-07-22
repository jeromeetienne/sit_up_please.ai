import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  root: 'web',
  base: command === 'serve' ? '/' : '/sit_up_please.ai/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
}));
