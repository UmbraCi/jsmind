import cleanup from 'rollup-plugin-cleanup';
import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';

const banner =
    '/**\n* @license BSD-3-Clause\n* @copyright 2014-2025 hizzgdev@163.com\n*\n* Project Home:\n*   https://github.com/hizzgdev/jsmind/\n*/';

const cleanupPlugin = cleanup({
    comments: 'none',
});

const terserPlugin = terser({
    output: {
        comments: 'all',
    },
});

// Main library configuration
const mainConfig = {
    input: 'src/jsmind.js',
    output: [
        // ES Module - for modern bundlers with tree-shaking support
        {
            file: 'es/jsmind.js',
            format: 'es',
            banner,
            sourcemap: true,
        },
        // CommonJS - for require/legacy toolchains
        {
            file: 'lib/jsmind.js',
            format: 'cjs',
            banner,
            sourcemap: true,
            exports: 'auto',
        },
        // UMD - for direct <script> usage, exposes global jsMind
        {
            name: 'jsMind',
            file: 'dist/jsmind.js',
            format: 'umd',
            banner,
            sourcemap: true,
        },
    ],
    plugins: [cleanupPlugin, terserPlugin],
};

// Draggable-node plugin configuration
const draggableNodeConfig = {
    input: 'src/plugins/jsmind.draggable-node.js',
    output: [
        // ES Module
        {
            file: 'es/jsmind.draggable-node.js',
            format: 'es',
            banner,
            sourcemap: true,
        },
        // CommonJS
        {
            file: 'lib/jsmind.draggable-node.js',
            format: 'cjs',
            banner,
            sourcemap: true,
            exports: 'named',
        },
        // UMD
        {
            name: 'jsMindDraggableNode',
            file: 'dist/jsmind.draggable-node.js',
            format: 'umd',
            banner,
            sourcemap: true,
            globals: { '@umbraci/jsmind': 'jsMind' },
            exports: 'named',
        },
    ],
    external: ['@umbraci/jsmind'],
    plugins: [cleanupPlugin, terserPlugin],
};

// Screenshot plugin configuration
const screenshotConfig = {
    input: 'src/plugins/jsmind.screenshot.js',
    output: [
        // ES Module
        {
            file: 'es/jsmind.screenshot.js',
            format: 'es',
            banner,
            sourcemap: true,
        },
        // CommonJS
        {
            file: 'lib/jsmind.screenshot.js',
            format: 'cjs',
            banner,
            sourcemap: true,
            exports: 'named',
        },
        // UMD
        {
            name: 'jsMindScreenshot',
            file: 'dist/jsmind.screenshot.js',
            format: 'umd',
            banner,
            sourcemap: true,
            globals: { '@umbraci/jsmind': 'jsMind', 'dom-to-image': 'domtoimage' },
            exports: 'named',
        },
    ],
    external: ['@umbraci/jsmind', 'dom-to-image'],
    plugins: [cleanupPlugin, terserPlugin],
};

// Multiline-text plugin configuration
const multilineTextConfig = {
    input: 'src/plugins/jsmind.multiline-text.js',
    output: [
        // ES Module
        {
            file: 'es/jsmind.multiline-text.js',
            format: 'es',
            banner,
            sourcemap: true,
        },
        // CommonJS
        {
            file: 'lib/jsmind.multiline-text.js',
            format: 'cjs',
            banner,
            sourcemap: true,
            exports: 'named',
        },
        // UMD
        {
            name: 'jsMindMultilineText',
            file: 'dist/jsmind.multiline-text.js',
            format: 'umd',
            banner,
            sourcemap: true,
            globals: { '@umbraci/jsmind': 'jsMind' },
            exports: 'named',
        },
    ],
    external: ['@umbraci/jsmind'],
    plugins: [cleanupPlugin, terserPlugin],
};

// History plugin configuration
const historyConfig = {
    input: 'src/plugins/history/jsmind.history.js',
    output: [
        // ES Module
        {
            file: 'es/jsmind.history.js',
            format: 'es',
            banner,
            sourcemap: true,
        },
        // CommonJS
        {
            file: 'lib/jsmind.history.js',
            format: 'cjs',
            banner,
            sourcemap: true,
            exports: 'named',
        },
        // UMD
        {
            name: 'jsMindHistory',
            file: 'dist/jsmind.history.js',
            format: 'umd',
            banner,
            sourcemap: true,
            globals: {
                '@umbraci/jsmind': 'jsMind',
            },
            exports: 'named',
        },
    ],
    external: ['@umbraci/jsmind'],
    plugins: [
        resolve({
            preferBuiltins: false,
        }),
        cleanupPlugin,
        terserPlugin,
    ],
};

// Copy-paste plugin configuration
const copyPasteConfig = {
    input: 'src/plugins/copy-paste/copy-paste-plugin-simple.js',
    output: [
        // ES Module
        {
            file: 'es/jsmind.copy-paste.js',
            format: 'es',
            banner,
            sourcemap: true,
        },
        // CommonJS
        {
            file: 'lib/jsmind.copy-paste.js',
            format: 'cjs',
            banner,
            sourcemap: true,
            exports: 'named',
        },
        // UMD
        {
            name: 'jsMindCopyPaste',
            file: 'dist/jsmind.copy-paste.js',
            format: 'umd',
            banner,
            sourcemap: true,
            globals: { '@umbraci/jsmind': 'jsMind' },
            exports: 'named',
        },
    ],
    external: ['@umbraci/jsmind'],
    plugins: [
        resolve({
            preferBuiltins: false,
        }),
        cleanupPlugin,
        terserPlugin,
    ],
};

export default [
    mainConfig,
    draggableNodeConfig,
    screenshotConfig,
    multilineTextConfig,
    historyConfig,
    copyPasteConfig
];