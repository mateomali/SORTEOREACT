const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  build: {
    outDir: 'assets/react',
    emptyOutDir: true,
    manifest: false,
    rollupOptions: {
      input: 'src/main.jsx',
      output: {
        entryFileNames: 'react-app.js',
        chunkFileNames: 'react-[name].js',
        assetFileNames: 'react-[name][extname]',
      },
    },
  },
});
