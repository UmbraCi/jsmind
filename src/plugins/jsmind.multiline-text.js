/**
 * @license BSD
 * @copyright 2014-2025 UmbraCi
 *
 * Project Home:
 *   https://github.com/hizzgdev/jsmind/
 */

import jsMind from '@umbraci/jsmind';
import { Plugin } from '../jsmind.plugin.js';

if (!jsMind) {
    throw new Error('jsMind is not defined');
}

const $ = jsMind.$;

/**
 * Default plugin options
 * @typedef {Object} MultilineTextOptions
 * @property {number} text_width - Maximum width for multiline text nodes (default: 200)
 * @property {number} min_height - Minimum editor height in pixels (default: 30)
 * @property {string} line_height - Line height for text (default: '1.5')
 * @property {string} editor_border_color - Editor border color (default: '#4CAF50')
 * @property {string} editor_border_width - Editor border width (default: '2px')
 * @property {boolean} auto_resize - Auto resize editor on input (default: true)
 */
const DEFAULT_OPTIONS = {
    text_width: 200,
    min_height: 30,
    line_height: '1.5',
    editor_border_color: '#4CAF50',
    editor_border_width: '2px',
    auto_resize: true,
};

/**
 * Create a custom node render function for multiline text
 * @param {Partial<MultilineTextOptions>} [options={}] - Plugin options
 * @returns {function(jsMind, HTMLElement, import('../jsmind.node.js').Node): boolean} Custom render function
 */
export function createMultilineRender(options = {}) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);

    return function (jm, element, node) {
        if (!node || typeof node.topic !== 'string' || !node.topic.includes('\n')) {
            return false;
        }
        element.style.whiteSpace = 'pre-wrap';
        element.style.wordBreak = 'break-word';
        element.style.maxWidth = opts.text_width + 'px';
        element.textContent = node.topic;
        return true;
    };
}

/**
 * Plugin initialization function
 * @param {import('../jsmind.js').default} jm - jsMind instance
 * @param {Partial<MultilineTextOptions>} options - Plugin options
 * @returns {MultilineTextPlugin}
 */
export function init(jm, options) {
    return new MultilineTextPlugin({ jm, pluginOpt: options || {} });
}

/**
 * Multiline text plugin for unified plugin system.
 */
export class MultilineTextPlugin extends Plugin {
    static instanceName = 'multilineText';
    static preload = true;

    /**
     * @param {{ jm: import('../jsmind.js').default, pluginOpt: Partial<MultilineTextOptions> }} params
     */
    constructor({ jm, pluginOpt }) {
        super({ jm, pluginOpt });
        this.options = Object.assign({}, DEFAULT_OPTIONS, pluginOpt || {});

        this.editing_node = null;
        this.multiline_editor = null;
        this._original_custom_render = null;
        this._original_edit_node_begin = null;
        this._original_edit_node_end = null;
        this._view_ready_timer = null;

        if (this.jm.view) {
            this.setupCustomRender();
            this.setupEditHandlers();
            this._rerender_all_nodes();
        } else {
            this.setupCustomRenderInOptions();
        }
    }

    setupCustomRenderInOptions() {
        if (!this.jm.options || !this.jm.options.view) {
            return;
        }

        this._original_custom_render = this.jm.options.view.custom_node_render;
        this.jm.options.view.custom_node_render = this._createCustomRender(this._original_custom_render);

        const checkViewReady = () => {
            if (this.jm.view && this.jm.mind) {
                this.setupEditHandlers();
                this._rerender_all_nodes();
                this._view_ready_timer = null;
                return;
            }
            this._view_ready_timer = setTimeout(checkViewReady, 10);
        };

        checkViewReady();
    }

    setupCustomRender() {
        if (!this.jm.view) {
            return;
        }

        const view = this.jm.view;
        const baseRender = view.opts ? view.opts.custom_node_render : null;
        this._original_custom_render = baseRender;

        if (view.opts) {
            view.opts.custom_node_render = this._createCustomRender(baseRender);
        }
        view.render_node = view._custom_node_render.bind(view);
    }

    setupEditHandlers() {
        if (!this.jm.view) {
            return;
        }

        const view = this.jm.view;

        if (!this._original_edit_node_begin) {
            this._original_edit_node_begin = view.edit_node_begin.bind(view);
        }
        if (!this._original_edit_node_end) {
            this._original_edit_node_end = view.edit_node_end.bind(view);
        }

        view.edit_node_begin = this.edit_node_begin.bind(this);
        view.edit_node_end = this.edit_node_end.bind(this);
    }

    _createCustomRender(originalCustomRender) {
        return (jm, element, node) => {
            let customRendered = false;
            if (typeof originalCustomRender === 'function') {
                customRendered = !!originalCustomRender(jm, element, node);
            }

            if (!customRendered) {
                if (node.topic && node.topic.includes('\n')) {
                    element.style.whiteSpace = 'pre-wrap';
                    element.style.wordBreak = 'break-word';
                    element.style.maxWidth = this.options.text_width + 'px';
                    element.textContent = node.topic;
                } else if (jm.options.support_html) {
                    $.h(element, node.topic);
                } else {
                    $.t(element, node.topic);
                }
            } else if (node.topic && node.topic.includes('\n')) {
                element.style.whiteSpace = 'pre-wrap';
                element.style.wordBreak = 'break-word';
            }

            return true;
        };
    }

    _rerender_all_nodes() {
        const view = this.jm.view;
        const mind = this.jm.mind;

        if (!view || !mind || !mind.root) {
            return;
        }

        const nodesToUpdate = [];
        for (const nodeId in mind.nodes) {
            const node = mind.nodes[nodeId];
            if (node._data && node._data.view && node._data.view.element) {
                nodesToUpdate.push(node);
            }
        }

        for (const node of nodesToUpdate) {
            const element = node._data.view.element;
            view.render_node(element, node);
        }

        for (const node of nodesToUpdate) {
            if (this.jm.layout.is_visible(node)) {
                const element = node._data.view.element;
                node._data.view.width = element.clientWidth;
                node._data.view.height = element.clientHeight;
            }
        }

        this.jm.layout.layout();
        this.jm.view.show(false);
    }

    /**
     * @param {import('../jsmind.node.js').Node} node
     */
    edit_node_begin(node) {
        if (!node.topic) {
            return;
        }

        if (this.editing_node) {
            this.edit_node_end();
        }

        this.editing_node = node;
        this.jm.view.editing_node = node;

        const editor = $.c('div');
        editor.contentEditable = 'plaintext-only';
        editor.className = 'jsmind-multiline-editor';
        editor.textContent = node.topic;
        this.multiline_editor = editor;

        const element = node._data.view.element;
        const computedStyle = getComputedStyle(element);
        const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
        const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;
        const editorWidth = Math.max(element.clientWidth - paddingLeft - paddingRight, this.options.text_width);

        Object.assign(editor.style, {
            width: editorWidth + 'px',
            minHeight: this.options.min_height + 'px',
            lineHeight: this.options.line_height,
            border: `${this.options.editor_border_width} solid ${this.options.editor_border_color}`,
            borderRadius: '4px',
            padding: '4px',
            outline: 'none',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            boxSizing: 'border-box',
            overflow: 'hidden',
        });

        if (this.options.auto_resize) {
            $.on(editor, 'input', () => {
                editor.style.height = 'auto';
                editor.style.height = Math.max(editor.scrollHeight, this.options.min_height) + 'px';
            });
        }

        $.on(editor, 'keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                this.edit_node_end();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.cancel_editing();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                this.edit_node_end();
            }
        });

        $.on(editor, 'blur', () => {
            setTimeout(() => {
                if (this.editing_node) {
                    this.edit_node_end();
                }
            }, 100);
        });

        element.innerHTML = '';
        element.appendChild(editor);
        element.style.zIndex = 5;
        editor.focus();

        const range = $.d.createRange();
        range.selectNodeContents(editor);
        const selection = $.w.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    edit_node_end() {
        if (!this.editing_node || !this.multiline_editor) {
            return;
        }

        const node = this.editing_node;
        const topic = (this.multiline_editor.textContent || '')
            .trim()
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\n{3,}/g, '\n\n');

        this._cleanup_editor();

        if (!jsMind.util.text.is_empty(topic) && node.topic !== topic) {
            this.jm.update_node(node.id, topic);
        } else {
            this.jm.view.render_node(node._data.view.element, node);
        }

        if (this.jm.view && this.jm.view.e_panel) {
            this.jm.view.e_panel.focus();
        }
    }

    cancel_editing() {
        if (!this.editing_node || !this.multiline_editor) {
            return;
        }

        const node = this.editing_node;
        this._cleanup_editor();
        this.jm.view.render_node(node._data.view.element, node);

        if (this.jm.view && this.jm.view.e_panel) {
            this.jm.view.e_panel.focus();
        }
    }

    _cleanup_editor() {
        if (!this.editing_node || !this.multiline_editor) {
            return;
        }

        const element = this.editing_node._data.view.element;
        if (this.multiline_editor.parentNode) {
            this.multiline_editor.parentNode.removeChild(this.multiline_editor);
        }

        element.style.zIndex = 'auto';
        this.editing_node = null;
        this.jm.view.editing_node = null;
        this.multiline_editor = null;
    }

    beforePluginRemove() {
        if (this._view_ready_timer) {
            clearTimeout(this._view_ready_timer);
            this._view_ready_timer = null;
        }

        if (this.multiline_editor && this.multiline_editor.parentNode) {
            this.multiline_editor.parentNode.removeChild(this.multiline_editor);
        }

        this.editing_node = null;
        this.multiline_editor = null;

        if (this.jm.options && this.jm.options.view) {
            this.jm.options.view.custom_node_render = this._original_custom_render;
        }

        if (!this.jm.view) {
            return;
        }

        const view = this.jm.view;
        if (view.opts) {
            view.opts.custom_node_render = this._original_custom_render;
        }
        view.render_node = view._default_node_render;

        if (this._original_edit_node_begin) {
            view.edit_node_begin = this._original_edit_node_begin;
        }
        if (this._original_edit_node_end) {
            view.edit_node_end = this._original_edit_node_end;
        }
    }

    beforePluginDestroy() {
        this.beforePluginRemove();
    }
}

jsMind.usePlugin(MultilineTextPlugin);

// Export for ES6 modules
export default {
    name: 'multiline_text',
    init,
    createMultilineRender,
    PluginClass: MultilineTextPlugin,
};
