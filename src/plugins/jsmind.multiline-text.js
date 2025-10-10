/**
 * @license BSD
 * @copyright 2014-2025 UmbraCi
 *
 * Project Home:
 *   https://github.com/UmbraCi/jsmind/
 */

import jsMind from '@umbraci/jsmind';

if (!jsMind) {
    throw new Error('jsMind is not defined');
}

const $ = jsMind.$;

/**
 * Create a multiline-aware custom node render function.
 * This function wraps the user's custom_node_render (if any) and adds multiline support.
 * @param {Function|null} userCustomRender - User's custom node render function
 * @returns {Function} A custom node render function with multiline support
 */
function createMultilineNodeRender(userCustomRender) {
    return function (jm, element, node) {
        let customRendered = false;

        // Try user's custom render first
        if (userCustomRender && typeof userCustomRender === 'function') {
            customRendered = userCustomRender(jm, element, node);
        }

        // If no custom render or custom render returns false, use default render
        if (!customRendered) {
            if (node.topic && node.topic.includes('\n')) {
                // Multiline text render
                element.textContent = node.topic;
                element.style.whiteSpace = 'pre-wrap';
                element.style.wordBreak = 'break-word';
            } else {
                // Single line text uses default render
                if (jm.options.support_html) {
                    $.h(element, node.topic);
                } else {
                    $.t(element, node.topic);
                }
            }
        } else if (node.topic && node.topic.includes('\n')) {
            // If user custom rendered, but is multiline text, apply multiline styles
            element.style.whiteSpace = 'pre-wrap';
            element.style.wordBreak = 'break-word';
        }

        return true;
    };
}

/**
 * Default options for multiline text plugin.
 * @typedef {Object} MultilineTextOptions
 * @property {number} [text_width] - Maximum text width in pixels
 * @property {string} [editor_border_color] - Border color for active editor
 * @property {string} [editor_border_width] - Border width for active editor
 * @property {boolean} [auto_resize] - Auto-resize editor as user types
 * @property {number} [min_height] - Minimum editor height
 * @property {number} [line_height] - Line height multiplier
 */
const DEFAULT_OPTIONS = {
    text_width: 200,
    editor_border_color: '#4CAF50',
    editor_border_width: '2px',
    auto_resize: true,
    min_height: 20,
    line_height: 1.2,
};

/**
 * Multiline text plugin for jsMind.
 */
export class MultilineText {
    /**
     * Create multiline text plugin instance.
     * @param {import('../jsmind.js').default} jm - jsMind instance
     * @param {Partial<MultilineTextOptions>} options - Plugin options
     */
    constructor(jm, options) {
        var opts = {};
        jsMind.util.json.merge(opts, DEFAULT_OPTIONS);
        jsMind.util.json.merge(opts, options);
        this.jm = jm;
        this.options = opts;
        this.editing_node = null;
        this.multiline_editor = null;
    }

    /** Initialize the multiline text plugin. */
    init() {
        const view = this.jm.view;

        // Save user's original custom_node_render
        const userCustomRender = view.opts.custom_node_render;

        // Create multiline-aware custom_node_render
        const multilineRender = createMultilineNodeRender(userCustomRender);

        // Update view.opts.custom_node_render
        view.opts.custom_node_render = multilineRender;

        // Update view.render_node to point to _custom_node_render
        view.render_node = view._custom_node_render;

        // Override edit methods
        view.edit_node_begin = this.edit_node_begin.bind(this);
        view.edit_node_end = this.edit_node_end.bind(this);

        // Re-render all nodes to apply multiline styles
        this._rerender_all_nodes();
    }

    /**
     * Re-render all nodes to apply multiline styles.
     * Performance optimization: batch update to avoid multiple reflows/repaints.
     * @private
     */
    _rerender_all_nodes() {
        const view = this.jm.view;
        const mind = this.jm.mind;

        if (!mind || !mind.root) {
            return;
        }

        // Collect all nodes to update
        const nodesToUpdate = [];
        for (const nodeId in mind.nodes) {
            const node = mind.nodes[nodeId];
            if (node._data && node._data.view && node._data.view.element) {
                nodesToUpdate.push(node);
            }
        }

        // Batch render nodes (only update DOM, no layout trigger)
        for (const node of nodesToUpdate) {
            const element = node._data.view.element;
            view.render_node(element, node);
        }

        // Batch update node sizes (read all sizes at once to avoid layout thrashing)
        for (const node of nodesToUpdate) {
            if (this.jm.layout.is_visible(node)) {
                const element = node._data.view.element;
                node._data.view.width = element.clientWidth;
                node._data.view.height = element.clientHeight;
            }
        }

        // Finally recalculate layout and show (only trigger reflow/repaint once)
        this.jm.layout.layout();
        this.jm.view.show(false);
    }

    /**
     * Begin editing a node with multiline support.
     * @param {import('../jsmind.node.js').Node} node - Node to edit
     */
    edit_node_begin(node) {
        if (!node.topic) {
            return;
        }

        // End editing if another node is being edited
        if (this.editing_node) {
            this.edit_node_end();
        }

        this.editing_node = node;
        this.jm.view.editing_node = node;

        // Create editor
        const editor = $.c('div');
        editor.contentEditable = 'plaintext-only';
        editor.className = 'jsmind-multiline-editor';
        editor.textContent = node.topic;
        this.multiline_editor = editor;

        // Calculate editor width
        const element = node._data.view.element;
        const computedStyle = getComputedStyle(element);
        const paddingX = parseInt(computedStyle.paddingLeft) + parseInt(computedStyle.paddingRight);
        const editorWidth = Math.max(element.clientWidth - paddingX, this.options.text_width);

        // Batch set styles (reduce reflows)
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
        });

        // Keyboard events
        $.on(editor, 'keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.edit_node_end();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancel_editing();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                this.edit_node_end();
            }
        });

        // Blur event
        $.on(editor, 'blur', () => {
            setTimeout(() => {
                if (this.editing_node) {
                    this.edit_node_end();
                }
            }, 100);
        });

        // Auto resize height
        if (this.options.auto_resize) {
            $.on(editor, 'input', () => {
                editor.style.height = 'auto';
                editor.style.height = Math.max(editor.scrollHeight, this.options.min_height) + 'px';
            });
        }

        // Replace node content and focus
        element.innerHTML = '';
        element.appendChild(editor);
        element.style.zIndex = 5;
        editor.focus();

        // Select all text
        const range = $.d.createRange();
        range.selectNodeContents(editor);
        const selection = $.w.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    /**
     * End editing and save changes.
     */
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

        // Clean up editor
        this._cleanup_editor();

        // Update node if content changed
        if (!jsMind.util.text.is_empty(topic) && node.topic !== topic) {
            this.jm.update_node(node.id, topic);
        } else {
            this.jm.view.render_node(node._data.view.element, node);
        }
    }

    /**
     * Cancel editing without saving changes.
     */
    cancel_editing() {
        if (!this.editing_node || !this.multiline_editor) {
            return;
        }

        const node = this.editing_node;

        // Clean up editor
        this._cleanup_editor();

        // Re-render node
        this.jm.view.render_node(node._data.view.element, node);
    }

    /**
     * Clean up editor and reset state.
     * @private
     */
    _cleanup_editor() {
        if (!this.editing_node || !this.multiline_editor) {
            return;
        }

        const element = this.editing_node._data.view.element;

        // Remove editor
        if (this.multiline_editor.parentNode) {
            this.multiline_editor.parentNode.removeChild(this.multiline_editor);
        }

        // Reset styles and state
        element.style.zIndex = 'auto';
        this.editing_node = null;
        this.jm.view.editing_node = null;
        this.multiline_editor = null;
        this.jm.view.e_panel.focus();
    }
}

/**
 * Multiline text plugin registration.
 * @type {import('../jsmind.plugin.js').Plugin<Partial<MultilineTextOptions>>}
 */
export const multiline_text_plugin = new jsMind.plugin('multiline_text', function (jm, options) {
    const mt = new MultilineText(jm, options);
    mt.init();
    jm.multiline_text = mt;
});

jsMind.register_plugin(multiline_text_plugin);

export default MultilineText;
