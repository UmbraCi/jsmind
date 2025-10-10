import cleanup from 'rollup-plugin-cleanup';
import terser from '@rollup/plugin-terser';

export default [
    {
        input: 'src/jsmind.js',
        output: {
            name: 'jsMind',
            file: 'es6/jsmind.js',
            format: 'umd',
            banner: '/**\n* @license BSD-3-Clause\n* @copyright 2014-2025 hizzgdev@163.com\n*\n* Project Home:\n*   https://github.com/hizzgdev/jsmind/\n*/',
            sourcemap: true,
        },
        plugins: [
            cleanup({
                comments: 'none',
            }),
            terser({
                output: {
                    comments: 'all',
                },
            }),
        ],
    },
    {
        input: 'src/plugins/jsmind.draggable-node.js',
        output: {
            name: 'jsMindDraggableNode',
            file: 'es6/jsmind.draggable-node.js',
            format: 'umd',
            banner: '/**\n* @license BSD-3-Clause\n* @copyright 2014-2025 hizzgdev@163.com\n*\n* Project Home:\n*   https://github.com/hizzgdev/jsmind/\n*/',
            sourcemap: true,
            globals: {
                '@umbraci/jsmind': 'jsMind',
            },
            exports: 'named',
        },
        external: ['@umbraci/jsmind'],
        plugins: [
            cleanup({
                comments: 'none',
            }),
            terser({
                output: {
                    comments: 'all',
                },
            }),
        ],
    },
    {
        input: 'src/plugins/jsmind.multiline-text.js',
        output: {
            name: 'jsMindMultilineText',
            file: 'es6/jsmind.multiline-text.js',
            format: 'umd',
            banner: '/**\n* @license BSD-3-Clause\n* @copyright 2014-2025 hizzgdev@163.com\n*\n* Project Home:\n*   https://github.com/hizzgdev/jsmind/\n*/',
            sourcemap: true,
            globals: {
                '@umbraci/jsmind': 'jsMind',
            },
            exports: 'named',
        },
        external: ['@umbraci/jsmind'],
        plugins: [
            cleanup({
                comments: 'none',
            }),
            terser({
                output: {
                    comments: 'all',
                },
            }),
        ],
    },
    {
        input: 'src/plugins/jsmind.screenshot.js',
        output: {
            name: 'jsMindScreenshot',
            file: 'es6/jsmind.screenshot.js',
            format: 'umd',
            banner: '/**\n* @license BSD-3-Clause\n* @copyright 2014-2025 hizzgdev@163.com\n*\n* Project Home:\n*   https://github.com/hizzgdev/jsmind/\n*/',
            sourcemap: true,
            globals: {
                '@umbraci/jsmind': 'jsMind',
                'dom-to-image': 'domtoimage',
            },
            exports: 'named',
        },
        external: ['@umbraci/jsmind', 'dom-to-image'],
        plugins: [
            cleanup({
                comments: 'none',
            }),
            terser({
                output: {
                    comments: 'all',
                },
            }),
        ],
    },
    {
        input: 'src/jsmind.enhanced-plugin.js',
        output: {
            name: 'jsMindEnhancedPlugin',
            file: 'es6/jsmind.enhanced-plugin.js',
            format: 'umd',
            banner: '/**\n* @license BSD-3-Clause\n* @copyright 2014-2025 hizzgdev@163.com\n*\n* Project Home:\n*   https://github.com/hizzgdev/jsmind/\n*/',
            sourcemap: true,
            exports: 'auto',
        },
        plugins: [
            cleanup({
                comments: 'none',
            }),
            terser({
                output: {
                    comments: 'all',
                },
            }),
        ],
    },
    {
        input: 'src/plugins/jsmind.multiline-text-v2.js',
        output: {
            name: 'MultilineTextV2',
            file: 'es6/jsmind.multiline-text-v2.js',
            format: 'umd',
            banner: '/**\n* @license BSD-3-Clause\n* @copyright 2014-2025 hizzgdev@163.com\n*\n* Project Home:\n*   https://github.com/hizzgdev/jsmind/\n*/',
            sourcemap: true,
            exports: 'default',
        },
        plugins: [
            cleanup({
                comments: 'none',
            }),
            terser({
                output: {
                    comments: 'all',
                },
            }),
        ],
    },
];
