import { defineConfig } from 'vite';
import { MediaPipeWebAssemblyPlugin } from './build/media_pipe_web_assembly_plugin';
import { ServiceWorkerPlugin } from './build/service_worker_plugin';

export default defineConfig(({ command }) => ({
  root: 'web',
  base: command === 'serve' ? '/' : '/sit_up_please.ai/',
  // The WebAssembly plugin runs first, so that the files it emits are already part of the bundle
  // when the service worker plugin reads it.
  plugins: [MediaPipeWebAssemblyPlugin.create(), ServiceWorkerPlugin.create()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  css: {
    preprocessorOptions: {
      scss: {
        // The compiler that runs Dart Sass as one long-lived process. The
        // Bootstrap source is large, and the compiler Vite reaches for by
        // default takes minutes over it where this one takes seconds.
        api: 'modern-compiler',
        // The Bootstrap 5 source is written with @import, with the global Sass
        // functions, with the Sass colour functions and with the Sass if()
        // function, all four of which Dart Sass now reports as deprecated. The
        // warnings belong to Bootstrap, not to this project, and there are
        // several hundred of them on every build. Each name has to be one Dart
        // Sass still knows: a name it has retired is itself reported, as
        // `mixed-decls` was once Bootstrap stopped writing the code that
        // raised it.
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
}));
