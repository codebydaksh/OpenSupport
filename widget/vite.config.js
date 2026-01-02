import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: 'src/widget.js',
            name: 'OpenSupportWidget',
            fileName: () => 'widget.js',
            formats: ['iife']
        },
        outDir: 'dist',
        minify: 'terser',
        sourcemap: false,
        rollupOptions: {
            output: {
                inlineDynamicImports: true
            }
        }
    },
    server: {
        port: 5174
    }
});
