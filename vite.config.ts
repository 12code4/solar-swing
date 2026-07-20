import { defineConfig } from 'vite';

// base: './' keeps every asset reference relative, so the build works when GitHub Pages
// serves the app from a project subpath (https://user.github.io/solar-swing/). An absolute
// '/' base would 404 every chunk there.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
