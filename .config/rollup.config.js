import cleanup from 'rollup-plugin-cleanup';
import terser from '@rollup/plugin-terser';

const banner =
    '/**\n* @license BSD-3-Clause\n* @copyright 2014-2025 hizzgdev@163.com\n*\n* Project Home:\n*   https://github.com/hizzgdev/jsmind/\n*/';

export default [
    // jsmind core - UMD
    {
        input: 'src/jsmind.js',
        output: {
            name: 'jsMind',
            file: 'es6/jsmind.js',
            format: 'umd',
            banner,
            sourcemap: true,
        },
        plugins: [cleanup({ comments: 'none' }), terser({ output: { comments: 'all' } })],
    },
    // jsmind core - ES6
    {
        input: 'src/jsmind.js',
        output: {
            file: 'es6/jsmind.esm.js',
            format: 'es',
            banner,
            sourcemap: true,
        },
        plugins: [cleanup({ comments: 'none' }), terser({ output: { comments: 'all' } })],
    },
    // draggable-node - UMD
    {
        input: 'src/plugins/jsmind.draggable-node.js',
        output: {
            name: 'jsMindDraggableNode',
            file: 'es6/jsmind.draggable-node.js',
            format: 'umd',
            banner,
            sourcemap: true,
            globals: { '@umbraci/jsmind': 'jsMind' },
            exports: 'named',
        },
        external: ['@umbraci/jsmind'],
        plugins: [cleanup({ comments: 'none' }), terser({ output: { comments: 'all' } })],
    },
    // draggable-node - ES6
    {
        input: 'src/plugins/jsmind.draggable-node.js',
        output: {
            file: 'es6/jsmind.draggable-node.esm.js',
            format: 'es',
            banner,
            sourcemap: true,
        },
        external: ['@umbraci/jsmind'],
        plugins: [cleanup({ comments: 'none' }), terser({ output: { comments: 'all' } })],
    },
    // screenshot - UMD
    {
        input: 'src/plugins/jsmind.screenshot.js',
        output: {
            name: 'jsMindScreenshot',
            file: 'es6/jsmind.screenshot.js',
            format: 'umd',
            banner,
            sourcemap: true,
            globals: { '@umbraci/jsmind': 'jsMind', 'dom-to-image': 'domtoimage' },
            exports: 'named',
        },
        external: ['@umbraci/jsmind', 'dom-to-image'],
        plugins: [cleanup({ comments: 'none' }), terser({ output: { comments: 'all' } })],
    },
    // screenshot - ES6
    {
        input: 'src/plugins/jsmind.screenshot.js',
        output: {
            file: 'es6/jsmind.screenshot.esm.js',
            format: 'es',
            banner,
            sourcemap: true,
        },
        external: ['@umbraci/jsmind', 'dom-to-image'],
        plugins: [cleanup({ comments: 'none' }), terser({ output: { comments: 'all' } })],
    },
    // multiline-text - UMD
    {
        input: 'src/plugins/jsmind.multiline-text.js',
        output: {
            name: 'jsMindMultilineText',
            file: 'es6/jsmind.multiline-text.js',
            format: 'umd',
            banner,
            sourcemap: true,
            globals: { '@umbraci/jsmind': 'jsMind' },
            exports: 'named',
        },
        external: ['@umbraci/jsmind'],
        plugins: [cleanup({ comments: 'none' }), terser({ output: { comments: 'all' } })],
    },
    // multiline-text - ES6
    {
        input: 'src/plugins/jsmind.multiline-text.js',
        output: {
            file: 'es6/jsmind.multiline-text.esm.js',
            format: 'es',
            banner,
            sourcemap: true,
        },
        external: ['@umbraci/jsmind'],
        plugins: [cleanup({ comments: 'none' }), terser({ output: { comments: 'all' } })],
    },
];
