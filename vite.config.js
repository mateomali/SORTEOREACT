const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  build: {
    modulePreload: false,
    outDir: 'assets/react',
    emptyOutDir: true,
    manifest: false,
    rollupOptions: {
      input: 'src/main.jsx',
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor';
          }
          return null;
        },
        entryFileNames: 'react-app.js',
        chunkFileNames: 'react-[name].js',
        assetFileNames: 'react-[name][extname]',
      },
    },
  },
});
