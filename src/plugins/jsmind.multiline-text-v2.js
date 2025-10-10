/**
 * @license BSD
 * @copyright 2014-2025 UmbraCi
 *
 * Project Home:
 *   https://github.com/UmbraCi/jsmind/
 */

import jsMind from '../jsmind.js';
import { EnhancedPlugin } from '../jsmind.enhanced-plugin.js';

const $ = jsMind.$;

/**
 * MultilineTextV2 Plugin
 * Enhanced multiline text plugin using the new plugin system
 */
class MultilineTextV2 extends EnhancedPlugin {
    static instanceName = 'multilineTextV2';
    static preload = true;

    /**
     * @param {{ jm: import('../jsmind.js').default, pluginOpt: object }} params
     */
    constructor({ jm, pluginOpt }) {
        super({ jm, pluginOpt });

        // Merge default options
        this.options = Object.assign(
            {
                text_width: 200,
                min_height: 30,
                line_height: '1.5',
                editor_border_color: '#4CAF50',
                editor_border_width: '2px',
                auto_resize: true,
            },
            pluginOpt
        );

        this.editing_node = null;
        this.multiline_editor = null;

        // Save original methods
        this._original_custom_render = null;
        this._original_edit_node_begin = null;
        this._original_edit_node_end = null;

        // Setup custom rendering
        // For preload plugins, view is not initialized yet, so we set it in options
        if (this.jm.view) {
            // Normal plugin: view is already initialized
            this.setupCustomRender();
        } else {
            // Preload plugin: set custom render in options before view initialization
            this.setupCustomRenderInOptions();
        }
    }

    /**
     * Setup custom rendering in options (for preload plugins)
     */
    setupCustomRenderInOptions() {
        // Save original custom render from options
        this._original_custom_render = this.jm.options.view.custom_node_render;

        // Create multiline-aware custom render function
        this.jm.options.view.custom_node_render = (jm, element, node) => {
            // Try user's custom render first
            let customRendered = false;
            if (
                this._original_custom_render &&
                typeof this._original_custom_render === 'function'
            ) {
                customRendered = this._original_custom_render(jm, element, node);
            }

            // If no custom render or returns false, use multiline render
            if (!customRendered) {
                if (node.topic && node.topic.includes('\n')) {
                    // Multiline text - apply styles BEFORE setting content
                    element.style.whiteSpace = 'pre-wrap';
                    element.style.wordBreak = 'break-word';
                    element.style.maxWidth = this.options.text_width + 'px';
                    element.textContent = node.topic;
                } else {
                    // Single line text
                    if (jm.options.support_html) {
                        $.h(element, node.topic);
                    } else {
                        $.t(element, node.topic);
                    }
                }
            } else if (node.topic && node.topic.includes('\n')) {
                // If custom rendered but is multiline, apply styles
                element.style.whiteSpace = 'pre-wrap';
                element.style.wordBreak = 'break-word';
            }

            return true;
        };

        // After view is initialized, re-render all nodes and recalculate sizes
        const checkViewReady = () => {
            if (this.jm.view && this.jm.mind) {
                this.setupEditHandlers();
                // Re-render all nodes to ensure correct sizing
                this._rerender_all_nodes();
            } else {
                setTimeout(checkViewReady, 10);
            }
        };
        checkViewReady();
    }

    /**
     * Setup custom rendering for multiline text (for normal plugins)
     */
    setupCustomRender() {
        const view = this.jm.view;

        // Save original custom render
        this._original_custom_render = view.opts.custom_node_render;

        // Create multiline-aware custom render function
        view.opts.custom_node_render = (jm, element, node) => {
            // Try user's custom render first
            let customRendered = false;
            if (
                this._original_custom_render &&
                typeof this._original_custom_render === 'function'
            ) {
                customRendered = this._original_custom_render(jm, element, node);
            }

            // If no custom render or returns false, use multiline render
            if (!customRendered) {
                if (node.topic && node.topic.includes('\n')) {
                    // Multiline text
                    element.textContent = node.topic;
                    element.style.whiteSpace = 'pre-wrap';
                    element.style.wordBreak = 'break-word';
                    element.style.maxWidth = this.options.text_width + 'px';
                } else {
                    // Single line text
                    if (jm.options.support_html) {
                        $.h(element, node.topic);
                    } else {
                        $.t(element, node.topic);
                    }
                }
            } else if (node.topic && node.topic.includes('\n')) {
                // If custom rendered but is multiline, apply styles
                element.style.whiteSpace = 'pre-wrap';
                element.style.wordBreak = 'break-word';
            }

            return true;
        };

        // Use custom render with correct binding
        view.render_node = view._custom_node_render.bind(view);

        // Setup edit handlers
        this.setupEditHandlers();
    }

    /**
     * Setup edit handlers (common for both preload and normal plugins)
     */
    setupEditHandlers() {
        const view = this.jm.view;

        // Save original edit methods
        this._original_edit_node_begin = view.edit_node_begin.bind(view);
        this._original_edit_node_end = view.edit_node_end.bind(view);

        // Override edit methods
        view.edit_node_begin = this.edit_node_begin.bind(this);
        view.edit_node_end = this.edit_node_end.bind(this);
    }

    /**
     * Re-render all nodes to apply multiline styles and recalculate sizes.
     * This is necessary because node sizes are calculated before custom styles are applied.
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
     * Begin editing a node
     * @param {import('../jsmind.node.js').Node} node
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

        // Create editor (div with contentEditable)
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
    }

    /**
     * Called before plugin is removed
     */
    beforePluginRemove() {
        const view = this.jm.view;

        // Restore original custom render
        view.opts.custom_node_render = this._original_custom_render;
        view.render_node = view._default_node_render;

        // Restore original edit methods
        if (this._original_edit_node_begin) {
            view.edit_node_begin = this._original_edit_node_begin;
        }
        if (this._original_edit_node_end) {
            view.edit_node_end = this._original_edit_node_end;
        }

        // Clean up editor
        if (this.multiline_editor && this.multiline_editor.parentNode) {
            this.multiline_editor.parentNode.removeChild(this.multiline_editor);
        }

        this.editing_node = null;
        this.multiline_editor = null;
    }

    /**
     * Called before jsMind instance is destroyed
     */
    beforePluginDestroy() {
        this.beforePluginRemove();
    }
}

export default MultilineTextV2;
