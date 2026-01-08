import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    root: './',
    base: './', // Relative base for static deployment
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
