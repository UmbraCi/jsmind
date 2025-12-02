/**
 * @license BSD
 * @copyright 2014-2025 UmbraCi
 *
 * Project Home:
 *   https://github.com/UmbraCi/jsmind/
 */

import { __version__, logger, EventType, Direction, LogLevel } from './jsmind.common.js';
import { merge_option } from './jsmind.option.js';
import { Mind } from './jsmind.mind.js';
import { Node } from './jsmind.node.js';
import { DataProvider } from './jsmind.data_provider.js';
import { LayoutProvider } from './jsmind.layout_provider.js';
import { ViewProvider } from './jsmind.view_provider.js';
import { ShortcutProvider } from './jsmind.shortcut_provider.js';
import { Plugin, register as _register_plugin, apply as apply_plugins } from './jsmind.plugin.js';
import { EnhancedPluginManager, EnhancedPlugin } from './jsmind.enhanced-plugin.js';
import { format } from './jsmind.format.js';
import { $ } from './jsmind.dom.js';
import { util as _util } from './jsmind.util.js';

/**
 * Event callback payload
 * @typedef {{ evt?: string, data?: unknown[], node?: string }} EventData
 */

/**
 * jsMind runtime: orchestrates data/layout/view/shortcut and exposes public API.
 */
export default class jsMind {
    static mind = Mind;
    static node = Node;
    static direction = Direction;
    static event_type = EventType;
    static $ = $;
    static plugin = Plugin;
    static register_plugin = _register_plugin;
    static util = _util;
    static enhanced_plugin = EnhancedPlugin;

    /** @type {Array<import('./jsmind.enhanced-plugin.js').PluginDescriptor>} */
    static enhancedPluginList = [];

    /**
     * Register an enhanced plugin
     * @param {typeof EnhancedPlugin} PluginClass - Plugin class
     * @param {object} [options={}] - Plugin options
     * @returns {typeof jsMind}
     */
    static usePlugin(PluginClass, options = {}) {
        // Check if already registered
        const exists = jsMind.enhancedPluginList.some(d => d.PluginClass === PluginClass);
        if (exists) {
            logger.warn('Plugin ' + PluginClass.name + ' already registered');
            return jsMind;
        }

        // Check instanceName
        if (!PluginClass.instanceName) {
            throw new Error('Plugin ' + PluginClass.name + ' must define static instanceName');
        }

        // Add to plugin list
        jsMind.enhancedPluginList.push({
            PluginClass,
            instanceName: PluginClass.instanceName,
            preload: PluginClass.preload || false,
            pluginOpt: options,
            instance: null,
        });

        return jsMind;
    }

    /**
     * Check if an enhanced plugin is registered
     * @param {typeof EnhancedPlugin} PluginClass - Plugin class
     * @returns {boolean}
     */
    static hasEnhancedPlugin(PluginClass) {
        return jsMind.enhancedPluginList.some(d => d.PluginClass === PluginClass);
    }

    /**
     * Create a jsMind instance.
     * @param {import('./jsmind.option.js').JsMindRuntimeOptions} options
     */
    constructor(options) {
        jsMind.current = this;
        this.options = merge_option(options);
        logger.level(LogLevel[this.options.log_level]);
        this.version = __version__;
        this.initialized = false;
        this.mind = null;
        /** @type {'single'|'multi'|null} */
        this._selection_mode = null;
        /** @type {import('./jsmind.node.js').Node|null} */
        this._last_selected_node = null;
        /** @type {Array<(type: number, data: EventData) => void>} */
        this.event_handles = [];
        this.init();
    }

    /** Initialize sub-systems and plugins. */
    init() {
        if (!!this.initialized) {
            return;
        }
        this.initialized = true;

        // Initialize enhanced plugin manager
        this.enhancedPluginManager = new EnhancedPluginManager(this);

        // Initialize preload plugins (before core modules)
        this.enhancedPluginManager.initPreloadPlugins();

        var opts_layout = {
            mode: this.options.mode,
            hspace: this.options.layout.hspace,
            vspace: this.options.layout.vspace,
            pspace: this.options.layout.pspace,
            cousin_space: this.options.layout.cousin_space,
        };
        var opts_view = {
            container: this.options.container,
            support_html: this.options.support_html,
            engine: this.options.view.engine,
            enable_device_pixel_ratio: this.options.view.enable_device_pixel_ratio,
            hmargin: this.options.view.hmargin,
            vmargin: this.options.view.vmargin,
            line_width: this.options.view.line_width,
            line_color: this.options.view.line_color,
            line_style: this.options.view.line_style,
            custom_line_render: this.options.view.custom_line_render,
            draggable: this.options.view.draggable,
            hide_scrollbars_when_draggable: this.options.view.hide_scrollbars_when_draggable,
            node_overflow: this.options.view.node_overflow,
            zoom: this.options.view.zoom,
            custom_node_render: this.options.view.custom_node_render,
            expander_style: this.options.view.expander_style,
        };
        // create instance of function provider
        this.data = new DataProvider(this);
        this.layout = new LayoutProvider(this, opts_layout);
        this.view = new ViewProvider(this, opts_view);
        this.shortcut = new ShortcutProvider(this, this.options.shortcut);

        this.data.init();
        this.layout.init();
        this.view.init();
        this.shortcut.init();

        this._event_bind();

        // Initialize normal plugins (after core modules)
        this.enhancedPluginManager.initNormalPlugins();

        // Apply old plugins (asynchronously)
        apply_plugins(this, this.options.plugin);
    }
    /** @returns {boolean} whether current mind map is editable */
    get_editable() {
        return this.options.editable;
    }
    /** enable editing */
    enable_edit() {
        this.options.editable = true;
    }
    /** disable editing */
    disable_edit() {
        this.options.editable = false;
    }
    /** @returns {boolean} whether view is draggable */
    get_view_draggable() {
        return this.options.view.draggable;
    }
    /** enable view dragging */
    enable_view_draggable() {
        this.options.view.draggable = true;
        this.view.setup_canvas_draggable(true);
    }
    /** disable view dragging */
    disable_view_draggable() {
        this.options.view.draggable = false;
        this.view.setup_canvas_draggable(false);
    }
    // options are 'mousedown', 'click', 'dblclick', 'mousewheel'
    /**
     * Enable default event handle.
     * @param {'mousedown'|'click'|'dblclick'|'mousewheel'} event_handle
     */
    enable_event_handle(event_handle) {
        this.options.default_event_handle['enable_' + event_handle + '_handle'] = true;
    }
    // options are 'mousedown', 'click', 'dblclick', 'mousewheel'
    /**
     * Disable default event handle.
     * @param {'mousedown'|'click'|'dblclick'|'mousewheel'} event_handle
     */
    disable_event_handle(event_handle) {
        this.options.default_event_handle['enable_' + event_handle + '_handle'] = false;
    }
    /**
     * Set theme name.
     * @param {string|null=} theme
     */
    set_theme(theme) {
        var theme_old = this.options.theme;
        this.options.theme = !!theme ? theme : null;
        if (theme_old != this.options.theme) {
            this.view.reset_theme();
            this.view.reset_custom_style();
        }
    }
    /** bind internal DOM events */
    _event_bind() {
        this.view.add_event(this, 'mousedown', this.mousedown_handle);
        this.view.add_event(this, 'click', this.click_handle);
        this.view.add_event(this, 'dblclick', this.dblclick_handle);
        this.view.add_event(this, 'wheel', this.mousewheel_handle, true);
    }
    /** @param {MouseEvent} e */
    mousedown_handle(e) {
        if (!this.options.default_event_handle['enable_mousedown_handle']) {
            return;
        }
        var element = e.target || event.srcElement;
        var node_id = this.view.get_binded_nodeid(element);
        var mode = this._get_multi_select_mode(e);
        if (!!node_id) {
            if (this.view.is_node(element)) {
                if (mode === 'ctrl') {
                    // Ctrl/Cmd + Click: toggle single node (add/remove only this node)
                    this._toggle_node_selection(node_id);
                } else if (mode === 'shift') {
                    // Shift+Click behavior:
                    // - Default (shift_simple_mode=false): select ONLY the clicked node and ALL its descendants (no siblings)
                    // - When shift_simple_mode=true: enable range mode (may include sibling branches per anchor..target)
                    if (this.options.selection && this.options.selection.shift_simple_mode) {
                        // Range mode
                        if (this.is_node_selected(node_id)) {
                            this._deselect_subtree(node_id);
                        } else {
                            this._range_select_nodes(node_id);
                        }
                    } else {
                        // Simple subtree mode (default)
                        var base = this.get_node(node_id);
                        if (base) {
                            if (this.is_node_selected(node_id)) {
                                this._deselect_subtree(node_id);
                            } else {
                                var nodes_to_add = this._collect_subtree_nodes(base, {
                                    includeChildren: true,
                                    respectFilter: true,
                                    skipRootFilter: true,
                                });
                                if (!nodes_to_add.length) {
                                    nodes_to_add = [base];
                                }
                                var added = this._append_selection(nodes_to_add, { focusNode: base });
                                if (added.length) {
                                    this.mind.selected = base;
                                    this._last_selected_node = base;
                                    this._selection_mode = this._derive_selection_mode();
                                    var addedIds = added.map(function (n) { return n.id; });
                                    this.invoke_event_handle(EventType.select, {
                                        evt: 'multi_select',
                                        data: addedIds,
                                        node: base.id,
                                        nodes: addedIds,
                                    });
                                }
                            }
                        }
                    }
                } else {
                    // Single click: clear all and select this node only
                    this.select_node(node_id);
                }
            }
        } else if (mode === null) {
            // Only clear selection if no modifier keys
            this.select_clear();
        }
    }
    /** @param {MouseEvent} e */
    click_handle(e) {
        if (!this.options.default_event_handle['enable_click_handle']) {
            return;
        }
        var element = e.target || event.srcElement;
        var is_expander = this.view.is_expander(element);
        if (is_expander) {
            var node_id = this.view.get_binded_nodeid(element);
            if (!!node_id) {
                this.toggle_node(node_id);
            }
        }
    }
    /** @param {MouseEvent} e */
    dblclick_handle(e) {
        if (!this.options.default_event_handle['enable_dblclick_handle']) {
            return;
        }
        if (this.get_editable()) {
            var element = e.target || event.srcElement;
            var is_node = this.view.is_node(element);
            if (is_node) {
                var node_id = this.view.get_binded_nodeid(element);
                if (!!node_id) {
                    this.begin_edit(node_id);
                }
            }
        }
    }
    // Use [Ctrl] + Mousewheel, to zoom in/out.
    /** @param {WheelEvent} e */
    mousewheel_handle(e) {
        // Test if mousewheel option is enabled and Ctrl key is pressed.
        var kc = (e.metaKey << 13) + (e.ctrlKey << 12) + (e.altKey << 11) + (e.shiftKey << 10);
        if (
            !this.options.default_event_handle['enable_mousewheel_handle'] ||
            this.options.view.zoom.mask_key !== kc
        ) {
            return;
        }
        var evt = e || event;
        // Avoid default page scrolling behavior.
        evt.preventDefault();

        if (evt.deltaY < 0) {
            this.view.zoom_in(evt); // wheel down
        } else {
            this.view.zoom_out(evt);
        }
    }
    /**
     * Begin editing a node.
     * @param {string | import('./jsmind.node.js').Node} node
     * @returns {boolean|void}
     */
    begin_edit(node) {
        if (!Node.is_node(node)) {
            var the_node = this.get_node(node);
            if (!the_node) {
                logger.error('the node[id=' + node + '] can not be found.');
                return false;
            } else {
                return this.begin_edit(the_node);
            }
        }
        if (this.get_editable()) {
            this.view.edit_node_begin(node);
        } else {
            logger.error('fail, this mind map is not editable.');
            return;
        }
    }
    /** End editing */
    end_edit() {
        this.view.edit_node_end();
    }
    /**
     * Toggle a node's expanded state.
     * @param {string | import('./jsmind.node.js').Node} node
     * @returns {void}
     */
    toggle_node(node) {
        if (!Node.is_node(node)) {
            var the_node = this.get_node(node);
            if (!the_node) {
                logger.error('the node[id=' + node + '] can not be found.');
                return;
            } else {
                this.toggle_node(the_node);
                return;
            }
        }
        if (node.isroot) {
            return;
        }
        this.view.save_location(node);
        this.layout.toggle_node(node);
        this.view.relayout();
        this.view.restore_location(node);
    }
    /**
     * Expand a node.
     * @param {string | import('./jsmind.node.js').Node} node
     * @returns {void}
     */
    expand_node(node) {
        if (!Node.is_node(node)) {
            var the_node = this.get_node(node);
            if (!the_node) {
                logger.error('the node[id=' + node + '] can not be found.');
                return;
            } else {
                this.expand_node(the_node);
                return;
            }
        }
        if (node.isroot) {
            return;
        }
        this.view.save_location(node);
        this.layout.expand_node(node);
        this.view.relayout();
        this.view.restore_location(node);
    }
    /**
     * Collapse a node.
     * @param {string | import('./jsmind.node.js').Node} node
     * @returns {void}
     */
    collapse_node(node) {
        if (!Node.is_node(node)) {
            var the_node = this.get_node(node);
            if (!the_node) {
                logger.error('the node[id=' + node + '] can not be found.');
                return;
            } else {
                this.collapse_node(the_node);
                return;
            }
        }
        if (node.isroot) {
            return;
        }
        this.view.save_location(node);
        this.layout.collapse_node(node);
        this.view.relayout();
        this.view.restore_location(node);
    }
    /** Expand all nodes */
    expand_all() {
        this.layout.expand_all();
        this.view.relayout();
    }
    /** Collapse all nodes */
    collapse_all() {
        this.layout.collapse_all();
        this.view.relayout();
    }
    /**
     * Expand nodes up to a specified depth level.
     * @param {number} depth
     */
    expand_to_depth(depth) {
        this.layout.expand_to_depth(depth);
        this.view.relayout();
    }
    /** reset view/layout/data */
    _reset() {
        this.invoke_event_handle(EventType.reset, { data: [] });
        this.view.reset();
        this.layout.reset();
        this.data.reset();
    }
    /**
     * Internal show flow.
     * @param {object | null} mind
     * @param {boolean=} skip_centering
     */
    _show(mind, skip_centering) {
        var m = mind || format.node_array.example;
        this.mind = this.data.load(m);
        if (!this.mind) {
            logger.error('data.load error');
            return;
        } else {
            logger.debug('data.load ok');
        }

        this.view.load();
        logger.debug('view.load ok');

        this.layout.layout();
        logger.debug('layout.layout ok');

        this.view.show(!skip_centering);
        logger.debug('view.show ok');

        this.invoke_event_handle(EventType.show, { data: [mind] });
    }
    /**
     * Show a mind (or example) on the canvas.
     * @param {object | null} mind
     * @param {boolean=} skip_centering
     */
    show(mind, skip_centering) {
        this._reset();
        this._show(mind, skip_centering);
    }
    /** @returns {{name:string,author:string,version:string}} */
    get_meta() {
        return {
            name: this.mind.name,
            author: this.mind.author,
            version: this.mind.version,
        };
    }
    /**
     * Serialize current mind to given format.
     * @param {'node_tree'|'node_array'|'freemind'|'text'} [data_format]
     * @returns {object}
     */
    get_data(data_format) {
        var df = data_format || 'node_tree';
        return this.data.get_data(df);
    }
    /** @returns {import('./jsmind.node.js').Node} */
    get_root() {
        return this.mind.root;
    }
    /**
     * @param {string | import('./jsmind.node.js').Node} node
     * @returns {import('./jsmind.node.js').Node}
     */
    get_node(node) {
        if (Node.is_node(node)) {
            return node;
        }
        return this.mind.get_node(node);
    }
    /**
     * Get the level/depth of a node in the mind map.
     * @param {string | import('./jsmind.node.js').Node} node - Node id or Node instance
     * @returns {number} Node level (root node is 0, its children are 1, etc.)
     */
    get_node_level(node) {
        var the_node = this.get_node(node);
        if (!the_node) {
            logger.warn('the node[id=' + node + '] can not be found.');
            return -1;
        }

        // Root node is at level 0
        if (the_node.isroot) {
            return 0;
        }

        var level = 0;
        var current = the_node;

        // Traverse up to root node, counting levels
        while (current.parent && !current.parent.isroot) {
            level++;
            current = current.parent;
        }

        // Add 1 for children of root node
        return level + 1;
    }
    /**
     * Add node data to the mind map without triggering UI refresh.
     * @private
     * @param {import('./jsmind.node.js').Node} parent_node
     * @param {string} node_id
     * @param {string} topic
     * @param {Record<string, any>=} data
     * @param {('left'|'center'|'right'|'-1'|'0'|'1'|number)=} direction
     * @returns {import('./jsmind.node.js').Node|null}
     */
    _add_node_data(parent_node, node_id, topic, data, direction) {
        var dir = Direction.of(direction);
        if (dir === undefined) {
            dir = this.layout.calculate_next_child_direction(parent_node);
        }

        var node = this.mind.add_node(parent_node, node_id, topic, data, dir);
        if (!!node) {
            this.view.add_node(node);
            this.view.reset_node_custom_style(node);
        }
        return node;
    }

    /**
     * Refresh UI after node changes.
     * @private
     * @param {import('./jsmind.node.js').Node} parent_node
     */
    _refresh_node_ui(parent_node) {
        this.layout.layout();
        this.view.show(false);
        this.expand_node(parent_node);
    }

    /**
     * Add a new node to the mind map.
     * @param {string | import('./jsmind.node.js').Node} parent_node
     * @param {string} node_id
     * @param {string} topic
     * @param {Record<string, any>=} data
     * @param {('left'|'center'|'right'|'-1'|'0'|'1'|number)=} direction - Direction for node placement. Supports string values ('left', 'center', 'right'), numeric strings ('-1', '0', '1'), and numbers (-1, 0, 1)
     * @returns {import('./jsmind.node.js').Node|null}
     */
    add_node(parent_node, node_id, topic, data, direction) {
        if (!this.get_editable()) {
            logger.error('fail, this mind map is not editable');
            return null;
        }

        var the_parent_node = this.get_node(parent_node);
        if (!the_parent_node) {
            logger.error('parent node not found');
            return null;
        }

        var node = this._add_node_data(the_parent_node, node_id, topic, data, direction);
        if (!!node) {
            this._refresh_node_ui(the_parent_node);
            this.invoke_event_handle(EventType.edit, {
                evt: 'add_node',
                data: [the_parent_node.id, node_id, topic, data, Direction.of(direction)],
                node: node_id,
            });
        }
        return node;
    }

    /**
     * Add multiple nodes in batch.
     *
     * This method provides atomic batch node creation with automatic rollback on failure.
     * All nodes are created in a single operation, and if any node fails to create,
     * all previously created nodes in this batch will be automatically removed.
     *
     * **Note**: This is a batch operation API that uses standard field names only.
     * For data import with custom fieldNames, use `show()` instead.
     *
     * @example
     * // Using standard field names
     * jm.add_nodes('parent_id', [
     *     { id: 'node1', topic: 'Node 1', data: { color: 'red' }, children: [
     *         { id: 'node1-1', topic: 'Child 1' }
     *     ]}
     * ]);
     *
     * @param {string | import('./jsmind.node.js').Node} parent_node - Parent node for all new nodes
     * @param {Array<{id: string, topic: string, data?: Record<string, any>, direction?: ('left'|'center'|'right'|'-1'|'0'|'1'|number), children?: Array}>} nodes_data - Array of node data objects with standard field names (id, topic, children, data, direction)
     * @returns {Array<import('./jsmind.node.js').Node|null>} Array of created nodes (flattened from all levels)
     */
    add_nodes(parent_node, nodes_data) {
        if (!this.get_editable()) {
            logger.error('fail, this mind map is not editable');
            return [];
        }

        var the_parent_node = this.get_node(parent_node);
        if (!the_parent_node) {
            logger.error('parent node not found');
            return [];
        }

        if (!Array.isArray(nodes_data) || nodes_data.length === 0) {
            logger.warn('nodes_data should be a non-empty array');
            return [];
        }

        const expected_count = this._count_expected_nodes(nodes_data);
        let created_nodes = nodes_data
            .map(node_data => this._add_nodes_recursive(the_parent_node, node_data))
            .flat()
            .filter(n => n !== null);

        const actual_count = created_nodes.length;

        // Atomic operation: either all nodes succeed or cleanup all partial nodes
        if (actual_count === expected_count) {
            // All nodes created successfully, refresh UI
            this._refresh_node_ui(the_parent_node);
            this.invoke_event_handle(EventType.edit, {
                evt: 'add_nodes',
                data: [the_parent_node.id, nodes_data],
                nodes: created_nodes.map(node => node.id),
            });
            return created_nodes;
        } else {
            // Cleanup partially created nodes to ensure atomicity
            logger.warn(
                `Expected ${expected_count} nodes, but only created ${actual_count}. Cleaning up...`
            );
            this._cleanup_partial_nodes(created_nodes);
            return [];
        }
    }

    /**
     * Recursively add nodes using standard field names.
     * This is a batch operation API that uses standard field names only.
     * For data import with custom fieldNames, use `show()` instead.
     * @private
     * @param {import('./jsmind.node.js').Node} parent_node
     * @param {object} node_data - Node data object with standard field names (id, topic, children, data, direction)
     * @returns {Array<import('./jsmind.node.js').Node|null>}
     */
    _add_nodes_recursive(parent_node, node_data) {
        var created_nodes = [];

        // Validate required fields (using standard field names only)
        if (!node_data.id || !node_data.topic) {
            logger.warn('invalid node data:', node_data);
            return [];
        }

        // Create the node using standard field names
        var new_node = this._add_node_data(
            parent_node,
            node_data.id,
            node_data.topic,
            node_data.data || {},
            node_data.direction
        );

        if (new_node) {
            created_nodes.push(new_node);
            // Process children using standard field name
            if (Array.isArray(node_data.children)) {
                const sub_nodes = node_data.children
                    .map(child => this._add_nodes_recursive(new_node, child))
                    .flat();
                created_nodes = created_nodes.concat(sub_nodes);
            }
        }

        return created_nodes;
    }

    /**
     * Count expected nodes recursively.
     * Supports custom field names via options.fieldNames configuration.
     * @private
     * @param {Array} nodes_data
     * @returns {number}
     */
    _count_expected_nodes(nodes_data) {
        if (!Array.isArray(nodes_data)) {
            return 0;
        }

        // Get field names from options (support custom field names)
        var fn = this.options.fieldNames || {};
        var childrenKey = fn.children || 'children';

        return nodes_data.reduce((count, node_data) => {
            count++; // Count current node
            // Use custom children field name
            count += this._count_expected_nodes(node_data && node_data[childrenKey]);
            return count;
        }, 0);
    }

    /**
     * Clean up partially created nodes without triggering UI refresh for each node.
     * @private
     * @param {Array<import('./jsmind.node.js').Node>} created_nodes
     */
    _cleanup_partial_nodes(created_nodes) {
        if (created_nodes.length === 0) return;
        // Remove all created nodes in reverse order to avoid parent-child issues
        // Use direct view and mind operations without triggering layout/show
        [...created_nodes].reverse().forEach(node => {
            if (node && !node.isroot) {
                // Remove from view without triggering layout
                this.view.remove_node(node);
                // Remove from mind model without triggering layout
                this.mind.remove_node(node);
            }
        });
    }

    /**
     * Insert a node before target node.
     * @param {string | import('./jsmind.node.js').Node} node_before
     * @param {string} node_id
     * @param {string} topic
     * @param {Record<string, any>=} data
     * @param {('left'|'center'|'right'|'-1'|'0'|'1'|number)=} direction - Direction for node placement. Supports string values ('left', 'center', 'right'), numeric strings ('-1', '0', '1'), and numbers (-1, 0, 1)
     * @returns {import('./jsmind.node.js').Node|null}
     */
    insert_node_before(node_before, node_id, topic, data, direction) {
        if (this.get_editable()) {
            var the_node_before = this.get_node(node_before);
            var dir = Direction.of(direction);
            if (dir === undefined) {
                dir = this.layout.calculate_next_child_direction(the_node_before.parent);
            }
            var node = this.mind.insert_node_before(the_node_before, node_id, topic, data, dir);
            if (!!node) {
                this.view.add_node(node);
                this.layout.layout();
                this.view.show(false);
                this.invoke_event_handle(EventType.edit, {
                    evt: 'insert_node_before',
                    data: [the_node_before.id, node_id, topic, data, dir],
                    node: node_id,
                });
            }
            return node;
        } else {
            logger.error('fail, this mind map is not editable');
            return null;
        }
    }
    /**
     * Insert a node after target node.
     * @param {string | import('./jsmind.node.js').Node} node_after
     * @param {string} node_id
     * @param {string} topic
     * @param {Record<string, any>=} data
     * @param {('left'|'center'|'right'|'-1'|'0'|'1'|number)=} direction - Direction for node placement. Supports string values ('left', 'center', 'right'), numeric strings ('-1', '0', '1'), and numbers (-1, 0, 1)
     * @returns {import('./jsmind.node.js').Node|null}
     */
    insert_node_after(node_after, node_id, topic, data, direction) {
        if (this.get_editable()) {
            var the_node_after = this.get_node(node_after);
            var dir = Direction.of(direction);
            if (dir === undefined) {
                dir = this.layout.calculate_next_child_direction(the_node_after.parent);
            }
            var node = this.mind.insert_node_after(the_node_after, node_id, topic, data, dir);
            if (!!node) {
                this.view.add_node(node);
                this.layout.layout();
                this.view.show(false);
                this.invoke_event_handle(EventType.edit, {
                    evt: 'insert_node_after',
                    data: [the_node_after.id, node_id, topic, data, dir],
                    node: node_id,
                });
            }
            return node;
        } else {
            logger.error('fail, this mind map is not editable');
            return null;
        }
    }
    /**
     * Remove a node.
     * @param {string | import('./jsmind.node.js').Node} node
     * @returns {boolean}
     */
    remove_node(node) {
        if (!Node.is_node(node)) {
            var the_node = this.get_node(node);
            if (!the_node) {
                logger.error('the node[id=' + node + '] can not be found.');
                return false;
            } else {
                return this.remove_node(the_node);
            }
        }
        if (this.get_editable()) {
            if (node.isroot) {
                logger.error('fail, can not remove root node');
                return false;
            }
            var node_id = node.id;
            var parent_id = node.parent.id;
            var parent_node = this.get_node(parent_id);
            this.view.save_location(parent_node);
            this.view.remove_node(node);
            this.mind.remove_node(node);
            // Clear _last_selected_node if the removed node was the last selected
            if (this._last_selected_node && this._last_selected_node.id === node_id) {
                this._last_selected_node = null;
            }
            this.layout.layout();
            this.view.show(false);
            this.view.restore_location(parent_node);
            this.invoke_event_handle(EventType.edit, {
                evt: 'remove_node',
                data: [node_id],
                node: parent_id,
            });
            return true;
        } else {
            logger.error('fail, this mind map is not editable');
            return false;
        }
    }
    /**
     * Update node topic text or multiple node properties.
     * @param {string} node_id - The ID of the node to update
     * @param {string|Partial<Pick<import('./jsmind.node.js').Node, 'topic' | 'data' | 'id' | 'index' | 'expanded' | 'direction'>>} topic_or_updates - Topic string for backward compatibility, or partial Node object for comprehensive updates
     */
    update_node(node_id, topic_or_updates) {
        if (!this.get_editable()) {
            logger.error('fail, this mind map is not editable');
            return;
        }

        var node = this.get_node(node_id);
        if (!!node) {
            // Handle backward compatibility: string parameter
            if (typeof topic_or_updates === 'string') {
                if (_util.text.is_empty(topic_or_updates)) {
                    logger.warn('fail, topic can not be empty');
                    return;
                }
                if (node.topic === topic_or_updates) {
                    logger.info('nothing changed');
                    this.view.update_node(node);
                    return;
                }
                node.topic = topic_or_updates;
                this.view.update_node(node);
                this.layout.layout();
                this.view.show(false);
                this.invoke_event_handle(EventType.edit, {
                    evt: 'update_node',
                    data: [node_id, topic_or_updates],
                    node: node_id,
                });
                return;
            }

            // Handle advanced updates with object parameter
            if (typeof topic_or_updates === 'object' && topic_or_updates !== null) {
                var originalId = node.id;
                var hasChanges = false;

                // Validate and apply topic change
                if (topic_or_updates.topic !== undefined) {
                    if (_util.text.is_empty(topic_or_updates.topic)) {
                        logger.warn('fail, topic can not be empty');
                        return;
                    }
                    if (node.topic !== topic_or_updates.topic) {
                        node.topic = topic_or_updates.topic;
                        hasChanges = true;
                    }
                }

                // Validate and apply data changes
                if (topic_or_updates.data && typeof topic_or_updates.data === 'object') {
                    for (var key in topic_or_updates.data) {
                        if (topic_or_updates.data.hasOwnProperty(key)) {
                            if (node.data[key] !== topic_or_updates.data[key]) {
                                node.data[key] = topic_or_updates.data[key];
                                hasChanges = true;
                            }
                        }
                    }
                }

                // Validate and apply ID change
                if (topic_or_updates.id !== undefined) {
                    if (
                        typeof topic_or_updates.id !== 'string' ||
                        topic_or_updates.id.trim() === ''
                    ) {
                        logger.error('fail, new node id must be a non-empty string');
                        return;
                    }

                    // Only proceed if there's an actual ID change
                    if (node.id !== topic_or_updates.id) {
                        // Validation checks
                        if (node.isroot) {
                            logger.error('fail, cannot change root node id');
                            return;
                        }

                        if (topic_or_updates.id in this.mind.nodes) {
                            logger.error(
                                'fail, new id "' + topic_or_updates.id + '" already exists'
                            );
                            return;
                        }

                        // Direct ID change implementation
                        var oldId = node.id;

                        // Remove from old mapping
                        delete this.mind.nodes[oldId];

                        // Update node ID
                        node.id = topic_or_updates.id;

                        // Add to new mapping
                        this.mind.nodes[topic_or_updates.id] = node;

                        // Update selected state if needed
                        if (this.mind.selected && this.mind.selected.id === oldId) {
                            this.mind.selected = node;
                        }

                        hasChanges = true;
                    }
                }

                // Apply other Node properties
                ['index', 'expanded', 'direction'].forEach(function (prop) {
                    if (
                        topic_or_updates[prop] !== undefined &&
                        node[prop] !== topic_or_updates[prop]
                    ) {
                        node[prop] = topic_or_updates[prop];
                        hasChanges = true;
                    }
                });

                if (!hasChanges) {
                    logger.info('nothing changed');
                    this.view.update_node(node);
                    return;
                }

                this.view.update_node(node);
                this.layout.layout();
                this.view.show(false);
                this.invoke_event_handle(EventType.edit, {
                    evt: 'update_node',
                    data: [originalId, topic_or_updates],
                    node: originalId,
                });
            }
        } else {
            logger.error('fail, node not found');
            return;
        }
    }
    /**
     * Move a node and optionally change direction.
     * @param {string} node_id
     * @param {string=} before_id - The ID of the node before which to place the moved node. Special values: "_first_", "_last_"
     * @param {string=} parent_id
     * @param {('left'|'center'|'right'|'-1'|'0'|'1'|number)=} direction - Direction for node placement. Supports string values ('left', 'center', 'right'), numeric strings ('-1', '0', '1'), and numbers (-1, 0, 1). Only effective for second-level nodes (children of root). If not provided, direction will be determined automatically.
     */
    move_node(node_id, before_id, parent_id, direction) {
        if (this.get_editable()) {
            var node = this.get_node(node_id);
            var updated_node = this.mind.move_node(node, before_id, parent_id, direction);
            if (!!updated_node) {
                this.view.update_node(updated_node);
                this.layout.layout();
                this.view.show(false);
                this.invoke_event_handle(EventType.edit, {
                    evt: 'move_node',
                    data: [node_id, before_id, parent_id, direction],
                    node: node_id,
                });
            }
        } else {
            logger.error('fail, this mind map is not editable');
            return;
        }
    }
    /**
     * @param {string | import('./jsmind.node.js').Node} node
     * @returns {void}
     */
    select_node(node) {
        if (!Node.is_node(node)) {
            var the_node = this.get_node(node);
            if (!the_node) {
                logger.error('the node[id=' + node + '] can not be found.');
                return;
            } else {
                this.select_node(the_node);
                return;
            }
        }
        if (!this.layout.is_visible(node)) {
            return;
        }
        this._clear_selection_state();
        this.mind.selected = node;
        this._last_selected_node = node;
        this._append_selection([node]);
        this._selection_mode = 'single';
        this.invoke_event_handle(EventType.select, {
            evt: 'select_node',
            data: [],
            node: node.id,
            nodes: [node.id],
        });
    }
    /**
     * Get the currently selected node.
     *
     * This is a query API that returns the internal Node instance.
     * For data export with custom fieldNames, use `get_data()` instead.
     *
     * @returns {import('./jsmind.node.js').Node|null} Node instance or null
     */
    get_selected_node() {
        if (!!this.mind) {
            return this.mind.selected;
        } else {
            return null;
        }
    }
    /**
     * Get all currently selected nodes.
     * @returns {import('./jsmind.node.js').Node[]}
     */
    get_selected_nodes() {
        if (!!this.mind) {
            return Array.from(this.mind.selected_nodes);
        }
        return [];
    }
    /** clear selection */
    select_clear() {
        if (!!this.mind) {
            this.mind.selected = null;
            this._last_selected_node = null;
            this._clear_selection_state();
        }
    }
    /**
     * Toggle multi-selection for a node (and optionally descendants).
     * @param {string | import('./jsmind.node.js').Node} node
     */
    toggle_subtree_selection(node) {
        if (!this.options.selection || !this.options.selection.enable_multi_select) {
            this.select_node(node);
            return;
        }
        if (!Node.is_node(node)) {
            var the_node = this.get_node(node);
            if (!the_node) {
                logger.error('the node[id=' + node + '] can not be found.');
                return;
            } else {
                this.toggle_subtree_selection(the_node);
                return;
            }
        }
        if (!this.layout.is_visible(node)) {
            return;
        }
        var isSelected = this.mind.selected_nodes.has(node);
        var shouldExpandSelection = !isSelected || this._selection_mode !== 'multi';
        if (shouldExpandSelection) {
            this._selection_mode = 'multi';
            var includeDescendants = this.options.selection.include_descendants !== false;
            var nodes_to_add = this._collect_subtree_nodes(node, {
                includeChildren: includeDescendants,
                respectFilter: true,
                skipRootFilter: true,
            });
            if (!nodes_to_add.length) {
                nodes_to_add = [node];
            }
            var added = this._append_selection(nodes_to_add, { focusNode: node });
            var ancestorAdded =
                node.parent && !this.mind.selected_nodes.has(node.parent)
                    ? this._ensure_ancestor_selection([node], node, {
                        requireAncestorChainSelected: true,
                    })
                    : [];
            var totalAdded = added.concat(ancestorAdded);
            if (totalAdded.length) {
                this.mind.selected = node;
                var addedIds = totalAdded.map(n => n.id);
                this.invoke_event_handle(EventType.select, {
                    evt: 'multi_select',
                    data: addedIds,
                    node: node.id,
                    nodes: addedIds,
                });
            }
        } else {
            var nodes_to_remove = this._collect_subtree_nodes(node, {
                includeChildren: true,
                respectFilter: false,
                skipRootFilter: false,
            });
            if (!nodes_to_remove.length) {
                nodes_to_remove = [node];
            }
            var removed = this._remove_selection(nodes_to_remove);
            if (removed.length) {
                if (this.mind.selected && this.mind.selected.id === node.id) {
                    this.mind.selected = null;
                }
                var removedIds = removed.map(n => n.id);
                this._selection_mode = this._derive_selection_mode();
                this.invoke_event_handle(EventType.select, {
                    evt: 'multi_deselect',
                    data: removedIds,
                    node: node.id,
                    nodes: removedIds,
                });
            }
        }
    }
    /**
     * Determine whether a node is currently selected.
     * @param {string | import('./jsmind.node.js').Node} node
     * @returns {boolean}
     */
    is_node_selected(node) {
        var target = node;
        if (!Node.is_node(node)) {
            target = this.get_node(node);
        }
        if (!target || !this.mind) {
            return false;
        }
        return this.mind.selected_nodes.has(target);
    }
    /** @param {string | import('./jsmind.node.js').Node} node */
    is_node_visible(node) {
        return this.layout.is_visible(node);
    }
    /**
     * Scroll the mind map to center the specified node.
     * @param {string | import('./jsmind.node.js').Node} node
     */
    scroll_node_to_center(node) {
        if (!Node.is_node(node)) {
            var the_node = this.get_node(node);
            if (!the_node) {
                logger.error('the node[id=' + node + '] can not be found.');
            } else {
                this.scroll_node_to_center(the_node);
            }
            return;
        }
        this.view.center_node(node);
    }
    /**
     * Add nodes into the current selection set without clearing existing ones.
     * @param {import('./jsmind.node.js').Node[]} nodes
     * @returns {import('./jsmind.node.js').Node[]}
     * @private
     */
    /**
     * @param {import('./jsmind.node.js').Node[]} nodes
     * @param {{focusNode?: import('./jsmind.node.js').Node}=} options
     * @private
     */
    _append_selection(nodes, options) {
        if (!nodes || !nodes.length) {
            return [];
        }
        var added = [];
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (!this.mind.selected_nodes.has(node)) {
                this.mind.selected_nodes.add(node);
                added.push(node);
            }
        }
        if (added.length) {
            var focusNode = options && options.focusNode ? options.focusNode : null;
            this.view.append_selected_nodes(added, focusNode || added[added.length - 1]);
        }
        return added;
    }
    /**
     * Remove nodes from the current selection set.
     * @param {import('./jsmind.node.js').Node[]} nodes
     * @returns {import('./jsmind.node.js').Node[]}
     * @private
     */
    _remove_selection(nodes) {
        if (!nodes || !nodes.length) {
            return [];
        }
        var removed = [];
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (this.mind.selected_nodes.has(node)) {
                this.mind.selected_nodes.delete(node);
                removed.push(node);
            }
        }
        if (removed.length) {
            this.view.remove_selected_nodes(removed);
        }
        return removed;
    }
    /**
     * Deselect a node and all its descendants from the current selection.
     * @param {string | import('./jsmind.node.js').Node} node
     * @private
     */
    _deselect_subtree(node) {
        var the_node = Node.is_node(node) ? node : this.get_node(node);
        if (!the_node) {
            logger.error('the node[id=' + node + '] can not be found.');
            return;
        }
        var nodes_to_remove = this._collect_subtree_nodes(the_node, {
            includeChildren: true,
            respectFilter: false,
            skipRootFilter: false,
        });
        if (!nodes_to_remove.length) {
            nodes_to_remove = [the_node];
        }
        var removed = this._remove_selection(nodes_to_remove);
        if (removed.length) {
            if (this.mind.selected && this.mind.selected.id === the_node.id) {
                this.mind.selected = null;
            }
            var removedIds = removed.map(function (n) { return n.id; });
            this._selection_mode = this._derive_selection_mode();
            this.invoke_event_handle(EventType.select, {
                evt: 'multi_deselect',
                data: removedIds,
                node: the_node.id,
                nodes: removedIds,
            });
        }
    }
    /**
     * Clear all current selections and return the nodes that were cleared.
     * @returns {import('./jsmind.node.js').Node[]}
     * @private
     */
    _clear_selection_state() {
        this._selection_mode = null;
        if (!this.mind.selected_nodes.size) {
            this.view.clear_all_selected_nodes();
            return [];
        }
        var nodes = Array.from(this.mind.selected_nodes);
        this.mind.selected_nodes.clear();
        this.view.remove_selected_nodes(nodes);
        return nodes;
    }
    /**
     * Collect a node and optionally its descendants respecting filters.
     * @param {import('./jsmind.node.js').Node} node
     * @param {{includeChildren?:boolean, respectFilter?:boolean, skipRootFilter?:boolean}=} config
     * @returns {import('./jsmind.node.js').Node[]}
     * @private
     */
    _collect_subtree_nodes(node, config) {
        var opts = config || {};
        var includeChildren = opts.includeChildren !== false;
        var respectFilter = !!opts.respectFilter;
        var skipRootFilter = !!opts.skipRootFilter;
        var filter = respectFilter ? this._get_selection_filter() : null;
        var collected = [];
        var traverse = function (current, isRoot) {
            var includeCurrent = true;
            if (filter && !(skipRootFilter && isRoot)) {
                includeCurrent = filter(current) !== false;
            }
            if (includeCurrent) {
                collected.push(current);
            }
            if (!includeChildren) {
                return;
            }
            var children = current.children || [];
            for (var i = 0; i < children.length; i++) {
                traverse(children[i], false);
            }
        };
        traverse(node, true);
        return collected;
    }
    /**
     * Ensure ancestors of provided nodes are also selected (up to first selected ancestor).
     * @param {import('./jsmind.node.js').Node[]} nodes
     * @param {import('./jsmind.node.js').Node=} focusNode
     * @returns {import('./jsmind.node.js').Node[]}
     * @private
     */
    /**
     * @param {import('./jsmind.node.js').Node[]} nodes
     * @param {import('./jsmind.node.js').Node=} focusNode
     * @param {{requireAncestorChainSelected?: boolean}=} options
     * @returns {import('./jsmind.node.js').Node[]}
     * @private
     */
    _ensure_ancestor_selection(nodes, focusNode, options) {
        if (!nodes || !nodes.length) {
            return [];
        }
        var requireChain = !!(options && options.requireAncestorChainSelected);
        var ancestors = [];
        var seen = Object.create(null);
        for (var i = 0; i < nodes.length; i++) {
            var current = nodes[i].parent;
            if (!current) {
                continue;
            }
            var path = [];
            var chainValid = !requireChain;
            while (current) {
                if (this.mind.selected_nodes.has(current)) {
                    chainValid = true;
                    break;
                }
                path.push(current);
                current = current.parent;
            }
            if (!chainValid) {
                continue;
            }
            for (var p = 0; p < path.length; p++) {
                var ancestorNode = path[p];
                if (!this.mind.selected_nodes.has(ancestorNode) && !seen[ancestorNode.id]) {
                    ancestors.push(ancestorNode);
                    seen[ancestorNode.id] = true;
                }
            }
        }
        if (!ancestors.length) {
            return [];
        }
        var anchor = focusNode || nodes[nodes.length - 1];
        return this._append_selection(ancestors, { focusNode: anchor });
    }
    /**
     * Get the configured selection filter callback, if any.
     * @returns {((node: import('./jsmind.node.js').Node)=>boolean)|null}
     * @private
     */
    _get_selection_filter() {
        var selection = this.options.selection || {};
        if (selection && typeof selection.filter === 'function') {
            return selection.filter;
        }
        return null;
    }
    /**
     * Determine the multi-select mode based on event modifiers.
     * Returns: null (single select), 'ctrl' (add/remove), 'shift' (range select)
     * @param {MouseEvent} e
     * @returns {null|'ctrl'|'shift'}
     * @private
     */
    _get_multi_select_mode(e) {
        var selection = this.options.selection || {};
        if (!selection.enable_multi_select) {
            return null;
        }
        if (!e) {
            return null;
        }
        if (e.shiftKey) {
            return 'shift';
        }
        if (e.ctrlKey || e.metaKey) {
            return 'ctrl';
        }
        return null;
    }
    /**
     * Toggle selection of a single node (add if not selected, remove if selected).
     * Used for Ctrl+Click behavior.
     * @param {string | import('./jsmind.node.js').Node} node_id
     * @private
     */
    _toggle_node_selection(node_id) {
        var node = Node.is_node(node_id) ? node_id : this.get_node(node_id);
        if (!node || !this.layout.is_visible(node)) {
            return;
        }
        var isSelected = this.mind.selected_nodes.has(node);
        if (isSelected) {
            // Deselect this node and all its descendants
            this._deselect_subtree(node);
        } else {
            this._selection_mode = 'multi';
            var added = this._append_selection([node]);
            if (added.length) {
                this.mind.selected = node;
                this._last_selected_node = node;
                this.invoke_event_handle(EventType.select, {
                    evt: 'multi_select',
                    data: [node.id],
                    node: node.id,
                    nodes: [node.id],
                });
            }
        }
    }
    /**
     * Range select nodes for Shift+Click behavior.
     * Logic:
     * - If no nodes are currently selected: select all nodes under the clicked node
     * - If nodes are already selected: select nodes in the range from first selected to clicked node
     * @param {string | import('./jsmind.node.js').Node} node_id
     * @private
     */
    _range_select_nodes(node_id) {
        var node = Node.is_node(node_id) ? node_id : this.get_node(node_id);
        if (!node || !this.layout.is_visible(node)) {
            return;
        }

        // If no nodes are currently selected, select all nodes under this node
        if (this.mind.selected_nodes.size === 0) {
            var descendantNodes = this._collect_subtree_nodes(node, {
                includeChildren: true,
                respectFilter: true,
                skipRootFilter: true,
            });
            if (!descendantNodes.length) {
                descendantNodes = [node];
            }
            var added = this._append_selection(descendantNodes);
            if (added.length) {
                this.mind.selected = node;
                this._last_selected_node = node;
                this._selection_mode = this._derive_selection_mode();
                var addedIds = added.map(n => n.id);
                this.invoke_event_handle(EventType.select, {
                    evt: 'multi_select',
                    data: addedIds,
                    node: node.id,
                    nodes: addedIds,
                });
            }
            return;
        }

        // If nodes are already selected, select range from anchor (prefer last selected if still selected) to current node
        var selectedNodesArray = Array.from(this.mind.selected_nodes);
        var firstSelectedNode = selectedNodesArray[0];
        var anchorNode = (this._last_selected_node && this.mind.selected_nodes.has(this._last_selected_node))
            ? this._last_selected_node
            : firstSelectedNode;

        // Build base nodes from the linear range between anchor and current node
        var nodesBetween = this._find_nodes_between(anchorNode, node);
        if (!nodesBetween.length) {
            nodesBetween = [node];
        }

        // Special case: selecting another branch under the same ancestor
        var expandedSet = new Set();
        var expandedSetReady = false;
        var siblingBranches = !this._is_ancestor_of(anchorNode, node) && !this._is_ancestor_of(node, anchorNode);
        // Precompute LCA and the branch head under LCA on the path to target
        var lca = this._find_lca(anchorNode, node);
        var childOnPath = this._child_on_path(lca, node);
        var anchorChild = this._child_on_path(lca, anchorNode);
        // Branch-range under same LCA: select every sibling branch between anchor and target (inclusive), with full subtrees
        var anchorChild = this._child_on_path(lca, anchorNode);
        var targetChild = this._child_on_path(lca, node);
        if (lca && anchorChild && targetChild && anchorChild !== targetChild && anchorNode === anchorChild && node === targetChild && !expandedSetReady) {
            var lcaChildren = Array.isArray(lca.children) ? lca.children : [];
            var ai = lcaChildren.indexOf(anchorChild);
            var ti = lcaChildren.indexOf(targetChild);
            if (ai >= 0 && ti >= 0) {
                var sidx = Math.min(ai, ti);
                var eidx = Math.max(ai, ti);
                for (var xi = sidx; xi <= eidx; xi++) {
                    var branchHead = lcaChildren[xi];
                    var branchTree = this._collect_subtree_nodes(branchHead, {
                        includeChildren: true,
                        respectFilter: false,
                        skipRootFilter: true,
                    });
                    for (var bt = 0; bt < branchTree.length; bt++) {
                        expandedSet.add(branchTree[bt]);
                    }
                }
                expandedSetReady = true;
            }
        }
        if (siblingBranches && anchorChild && targetChild && anchorNode === anchorChild && node === targetChild) {
            // Use nodesBetween to gather intermediate top-level branches (excluding anchor subtree and node's ancestor chain)
            var midNodes = [];
            for (var mb = 0; mb < nodesBetween.length; mb++) {
                var m = nodesBetween[mb];
                if (m === anchorNode) continue;
                if (this._is_ancestor_of(anchorNode, m)) continue; // skip nodes under the anchor's branch
                if (this._is_ancestor_of(m, node)) continue; // skip ancestors of target branch (e.g., B when clicking B-2)
                midNodes.push(m);
            }
            var baseNodes = this._remove_descendant_nodes(midNodes);
            for (var bi = 0; bi < baseNodes.length; bi++) {
                var base = baseNodes[bi];
                var baseFull = this._collect_subtree_nodes(base, {
                    includeChildren: true,
                    respectFilter: false,
                    skipRootFilter: true,
                });
                for (var bfi = 0; bfi < baseFull.length; bfi++) {
                    expandedSet.add(baseFull[bfi]);
                }
            }
            // Now handle the target branch itself
            if (childOnPath && node !== childOnPath) {
                // descendant in target branch: include siblings up to target, including their subtrees
                var p = node.parent;
                if (p && Array.isArray(p.children)) {
                    var idx = p.children.indexOf(node);
                    for (var si = 0; si <= idx; si++) {
                        var sib = p.children[si];
                        var sibSubtree = this._collect_subtree_nodes(sib, {
                            includeChildren: true,
                            respectFilter: false,
                            skipRootFilter: true,
                        });
                        for (var ssi = 0; ssi < sibSubtree.length; ssi++) {
                            expandedSet.add(sibSubtree[ssi]);
                        }
                    }
                } else {
                    expandedSet.add(node);
                }
            } else {
                // target is branch head: include its entire subtree (including the head)
                var full = this._collect_subtree_nodes(node, {
                    includeChildren: true,
                    respectFilter: false,
                    skipRootFilter: true,
                });
                for (var fi = 0; fi < full.length; fi++) {
                    expandedSet.add(full[fi]);
                }
            }
            expandedSetReady = true;
        }
        if (!expandedSetReady) {
            // Build selection within the target branch only
            if (childOnPath) {
                if (node === childOnPath) {
                    // Branch head: include its entire subtree (including the head)
                    var fullHead = this._collect_subtree_nodes(node, {
                        includeChildren: true,
                        respectFilter: false,
                        skipRootFilter: true,
                    });
                    for (var hi = 0; hi < fullHead.length; hi++) {
                        expandedSet.add(fullHead[hi]);
                    }
                } else {
                    // Descendant: include siblings up to target, including each sibling's subtree
                    var p = node.parent;
                    if (p && Array.isArray(p.children)) {
                        var idx = p.children.indexOf(node);
                        for (var si = 0; si <= idx; si++) {
                            var sib = p.children[si];
                            var sibTree = this._collect_subtree_nodes(sib, {
                                includeChildren: true,
                                respectFilter: false,
                                skipRootFilter: true,
                            });
                            for (var sti = 0; sti < sibTree.length; sti++) {
                                expandedSet.add(sibTree[sti]);
                            }
                        }
                    } else {
                        var onlyTree = this._collect_subtree_nodes(node, {
                            includeChildren: true,
                            respectFilter: false,
                            skipRootFilter: true,
                        });
                        for (var oti = 0; oti < onlyTree.length; oti++) {
                            expandedSet.add(onlyTree[oti]);
                        }
                    }
                }
            } else {
                // Fallback: include siblings up to target under its immediate parent (and their subtrees)
                var p2 = node.parent;
                if (p2 && Array.isArray(p2.children)) {
                    var idx2 = p2.children.indexOf(node);
                    for (var sj = 0; sj <= idx2; sj++) {
                        var s2 = p2.children[sj];
                        var s2Tree = this._collect_subtree_nodes(s2, {
                            includeChildren: true,
                            respectFilter: false,
                            skipRootFilter: true,
                        });
                        for (var s2i = 0; s2i < s2Tree.length; s2i++) {
                            expandedSet.add(s2Tree[s2i]);
                        }
                    }
                } else {
                    expandedSet.add(node);
                }
            }
        }

        // Safety fallback: if nothing was inferred, include the target node and its entire subtree
        if (expandedSet.size === 0 && node) {
            var fallbackAll = this._collect_subtree_nodes(node, {
                includeChildren: true,
                respectFilter: false,
                skipRootFilter: true,
            });
            for (var fk = 0; fk < fallbackAll.length; fk++) {
                expandedSet.add(fallbackAll[fk]);
            }
        }

        // Post-filter: if selecting a descendant within a branch, remove later siblings and their subtrees
        if (childOnPath && node !== childOnPath && node.parent && Array.isArray(node.parent.children)) {
            var p = node.parent;
            var idx = p.children.indexOf(node);
            for (var ri = idx + 1; ri < p.children.length; ri++) {
                var rem = p.children[ri];
                // remove the sibling and its entire subtree if present in the expanded set
                var remNodes = this._collect_subtree_nodes(rem, {
                    includeChildren: true,
                    respectFilter: false,
                    skipRootFilter: true,
                });
                for (var rj = 0; rj < remNodes.length; rj++) {
                    if (expandedSet.has(remNodes[rj])) {
                        expandedSet.delete(remNodes[rj]);
                    }
                }
            }
        }

        // Always include the clicked node itself
        if (node) {
            expandedSet.add(node);
        }

        // Step 4: Add to current selection (do not clear existing Ctrl selections)
        var toAddArr = Array.from(expandedSet).filter(function (n) { return !this.mind.selected_nodes.has(n); }.bind(this));
        var added = this._append_selection(toAddArr);
        if (added.length) {
            this.mind.selected = node;
            this._last_selected_node = node;
            this._selection_mode = this._derive_selection_mode();
            var addedIds = added.map(function (n) { return n.id; });
            this.invoke_event_handle(EventType.select, {
                evt: 'multi_select',
                data: addedIds,
                node: node.id,
                nodes: addedIds,
            });
        }
    }
    /**
     * Find all nodes between two nodes (for range selection).
     * This includes both nodes and all nodes in between them in tree order.
     * @param {import('./jsmind.node.js').Node} node1
     * @param {import('./jsmind.node.js').Node} node2
     * @returns {import('./jsmind.node.js').Node[]}
     * @private
     */
    _find_nodes_between(node1, node2) {
        if (!node1 || !node2) {
            return [];
        }
        // Get all visible nodes in tree order
        var allNodes = [];
        var traverse = (node) => {
            if (this.layout.is_visible(node)) {
                allNodes.push(node);
            }
            if (node.children && node.children.length) {
                for (var i = 0; i < node.children.length; i++) {
                    traverse(node.children[i]);
                }
            }
        };
        if (this.mind && this.mind.root) {
            traverse(this.mind.root);
        }
        // Find indices of both nodes
        var idx1 = -1, idx2 = -1;
        for (var i = 0; i < allNodes.length; i++) {
            if (allNodes[i].id === node1.id) idx1 = i;
            if (allNodes[i].id === node2.id) idx2 = i;
        }
        if (idx1 === -1 || idx2 === -1) {
            return [];
        }
        // Return nodes between (inclusive)
        var start = Math.min(idx1, idx2);
        var end = Math.max(idx1, idx2);
        return allNodes.slice(start, end + 1);
    }

    /**
     * Check whether ancestor is an ancestor of node.
     * @param {import('./jsmind.node.js').Node} ancestor
     * @param {import('./jsmind.node.js').Node} node
     * @returns {boolean}
     * @private
     */
    _is_ancestor_of(ancestor, node) {
        if (!ancestor || !node) return false;
        var cur = node.parent;
        while (cur) {
            if (cur === ancestor) return true;
            cur = cur.parent;
        }
        return false;
    }

    /**
     * Return nodes along the ancestor->descendant chain, inclusive. If 'ancestor' is not actually
     * an ancestor of 'descendant', returns empty array.
     * @param {import('./jsmind.node.js').Node} ancestor
     * @param {import('./jsmind.node.js').Node} descendant
     * @returns {import('./jsmind.node.js').Node[]}
     * @private
     */
    _get_path_nodes(ancestor, descendant) {
        if (!ancestor || !descendant) return [];
        var stack = [];
        var cur = descendant;
        while (cur) {
            stack.push(cur);
            if (cur === ancestor) break;
            cur = cur.parent;
        }
        if (!stack.length || stack[stack.length - 1] !== ancestor) {
            return [];
        }
        // stack is [descendant ... ancestor]; reverse to ancestor..descendant
        stack.reverse();
        return stack;
    }

    /**
     * Find nearest selected ancestor of the given node from current selection set.
     * @param {import('./jsmind.node.js').Node} node
     * @returns {import('./jsmind.node.js').Node|null}
     * @private
     */
    _find_nearest_selected_ancestor(node) {
        if (!node || !this.mind || !this.mind.selected_nodes) return null;
        var cur = node.parent;
        while (cur) {
            if (this.mind.selected_nodes.has(cur)) return cur;
            cur = cur.parent;
        }
        return null;
    }

    /**
     * Find lowest common ancestor of two nodes.
     * @param {import('./jsmind.node.js').Node} a
     * @param {import('./jsmind.node.js').Node} b
     * @returns {import('./jsmind.node.js').Node|null}
     * @private
     */
    _find_lca(a, b) {
        if (!a || !b) return null;
        if (a === b) return a.parent || a; // trivial
        var ancestors = new Set();
        var cur = a;
        while (cur) {
            ancestors.add(cur);
            cur = cur.parent;
        }
        cur = b;
        while (cur) {
            if (ancestors.has(cur)) return cur;
            cur = cur.parent;
        }
        return null;
    }

    /**
     * Given a lowest common ancestor 'lca' and a descendant 'node',
     * return the direct child of lca that lies on the path to node.
     * Returns null if node is not a descendant of lca or node === lca.
     * @param {import('./jsmind.node.js').Node} lca
     * @param {import('./jsmind.node.js').Node} node
     * @returns {import('./jsmind.node.js').Node|null}
     * @private
     */
    _child_on_path(lca, node) {
        if (!lca || !node) return null;
        if (lca === node) return null;
        var cur = node;
        while (cur && cur.parent && cur.parent !== lca) {
            cur = cur.parent;
        }
        if (cur && cur.parent === lca) return cur;
        return null;
    }

    /**
     * From a list of nodes, remove those that are ancestors of any other node in the same list.
     * Keeps only the deepest nodes so that we don't auto-select parents implicitly.
     * @param {import('./jsmind.node.js').Node[]} nodes
     * @returns {import('./jsmind.node.js').Node[]}
     * @private
     */
    _remove_ancestor_nodes(nodes, preserveSet) {
        if (!nodes || !nodes.length) return [];
        var preserve = preserveSet || new Set();
        var result = [];
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (preserve.has(n)) {
                result.push(n);
                continue;
            }
            var isAncestor = false;
            for (var j = 0; j < nodes.length; j++) {
                if (i === j) continue;
                if (this._is_ancestor_of(n, nodes[j])) {
                    isAncestor = true;
                    break;
                }
            }
            if (!isAncestor) result.push(n);
        }
        return result;
    }

    /**
     * From a list of nodes, remove those that are descendants of any other node in the same list.
     * Keeps only top-most nodes so that expanding subtrees covers full branches across siblings.
     * @param {import('./jsmind.node.js').Node[]} nodes
     * @returns {import('./jsmind.node.js').Node[]}
     * @private
     */
    _remove_descendant_nodes(nodes) {
        if (!nodes || !nodes.length) return [];
        var result = [];
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            var isDescendant = false;
            for (var j = 0; j < nodes.length; j++) {
                if (i === j) continue;
                if (this._is_ancestor_of(nodes[j], n)) {
                    isDescendant = true;
                    break;
                }
            }
            if (!isDescendant) result.push(n);
        }
        return result;
    }

    /**
     * Expand a set of base nodes with all their descendants (and themselves).
     * @param {import('./jsmind.node.js').Node[]} nodes
     * @param {{respectFilter?: boolean}=} opts
     * @returns {Set<import('./jsmind.node.js').Node>}
     * @private
     */
    _expand_with_descendants(nodes, opts) {
        var respectFilter = !!(opts && opts.respectFilter);
        var out = new Set();
        if (!nodes || !nodes.length) return out;
        for (var i = 0; i < nodes.length; i++) {
            var base = nodes[i];
            var list = this._collect_subtree_nodes(base, {
                includeChildren: true,
                respectFilter: respectFilter,
                skipRootFilter: true,
            });
            for (var k = 0; k < list.length; k++) {
                out.add(list[k]);
            }
        }
        return out;
    }

    /**
     * Promote parents into selection ONLY when all their direct children are selected
     * AND at least one ancestor of that parent is already selected (in previous selection set).
     * This avoids auto-selecting parents when only siblings are selected.
     * @param {Set<import('./jsmind.node.js').Node>} set
     * @returns {Set<import('./jsmind.node.js').Node>}
     * @private
     */
    _promote_parents_when_children_selected(set) {
        if (!set || !set.size) return set || new Set();
        var selectedSet = new Set(set);
        var prevSel = (this.mind && this.mind.selected_nodes) ? this.mind.selected_nodes : new Set();
        var changed = true;
        while (changed) {
            changed = false;
            var toAdd = [];
            selectedSet.forEach(function (node) {
                var p = node.parent;
                if (!p) return;
                if (selectedSet.has(p)) return;
                // require an ancestor of p to be in previous selection
                var ancestorSelected = false;
                var cur = p.parent;
                while (cur) {
                    if (prevSel.has(cur)) {
                        ancestorSelected = true;
                        break;
                    }
                    cur = cur.parent;
                }
                if (ancestorSelected) toAdd.push(p);
            });
            if (toAdd.length) {
                for (var t = 0; t < toAdd.length; t++) {
                    selectedSet.add(toAdd[t]);
                }
                changed = true;
            }
        }
        return selectedSet;
    }

    /**
     * Determine selection mode based on current selection size.
     * @returns {'single'|'multi'|null}
     * @private
     */
    _derive_selection_mode() {
        var size = this.mind.selected_nodes.size;
        if (size === 0) {
            return null;
        }
        return size > 1 ? 'multi' : 'single';
    }
    /**
     * Find the previous sibling node of the given node.
     *
     * @param {string | import('./jsmind.node.js').Node} node - Node id or Node instance
     * @returns {import('./jsmind.node.js').Node | null}
     */
    find_node_before(node) {
        if (!Node.is_node(node)) {
            var the_node = this.get_node(node);
            if (!the_node) {
                logger.error('the node[id=' + node + '] can not be found.');
                return;
            } else {
                return this.find_node_before(the_node);
            }
        }
        if (node.isroot) {
            return null;
        }
        var n = null;
        if (node.parent.isroot) {
            var c = node.parent.children;
            var prev = null;
            var ni = null;
            for (var i = 0; i < c.length; i++) {
                ni = c[i];
                if (node.direction === ni.direction) {
                    if (node.id === ni.id) {
                        n = prev;
                    }
                    prev = ni;
                }
            }
        } else {
            n = this.mind.get_node_before(node);
        }
        return n;
    }
    /**
     * Find the next sibling node of the given node.
     * @param {string | import('./jsmind.node.js').Node} node
     * @returns {import('./jsmind.node.js').Node | null}
     */
    find_node_after(node) {
        if (!Node.is_node(node)) {
            var the_node = this.get_node(node);
            if (!the_node) {
                logger.error('the node[id=' + node + '] can not be found.');
                return;
            } else {
                return this.find_node_after(the_node);
            }
        }
        if (node.isroot) {
            return null;
        }
        var n = null;
        if (node.parent.isroot) {
            var c = node.parent.children;
            var found = false;
            var ni = null;
            for (var i = 0; i < c.length; i++) {
                ni = c[i];
                if (node.direction === ni.direction) {
                    if (found) {
                        n = ni;
                        break;
                    }
                    if (node.id === ni.id) {
                        found = true;
                    }
                }
            }
        } else {
            n = this.mind.get_node_after(node);
        }
        return n;
    }
    /**
     * Set background and foreground colors for a node.
     * @param {string} node_id
     * @param {string=} bg_color
     * @param {string=} fg_color
     * @returns {void}
     */
    set_node_color(node_id, bg_color, fg_color) {
        if (this.get_editable()) {
            var node = this.mind.get_node(node_id);
            if (!!node) {
                if (!!bg_color) {
                    node.data['background-color'] = bg_color;
                }
                if (!!fg_color) {
                    node.data['foreground-color'] = fg_color;
                }
                this.view.reset_node_custom_style(node);
            }
        } else {
            logger.error('fail, this mind map is not editable');
            return null;
        }
    }
    /**
     * Set font style for a node.
     * @param {string} node_id
     * @param {number=} size
     * @param {string=} weight
     * @param {string=} style
     * @returns {void}
     */
    set_node_font_style(node_id, size, weight, style) {
        if (this.get_editable()) {
            var node = this.mind.get_node(node_id);
            if (!!node) {
                if (!!size) {
                    node.data['font-size'] = size;
                }
                if (!!weight) {
                    node.data['font-weight'] = weight;
                }
                if (!!style) {
                    node.data['font-style'] = style;
                }
                this.view.reset_node_custom_style(node);
                this.view.update_node(node);
                this.layout.layout();
                this.view.show(false);
            }
        } else {
            logger.error('fail, this mind map is not editable');
            return null;
        }
    }
    /**
     * Set background image for a node.
     * @param {string} node_id
     * @param {string=} image
     * @param {number=} width
     * @param {number=} height
     * @param {number=} rotation
     * @returns {void}
     */
    set_node_background_image(node_id, image, width, height, rotation) {
        if (this.get_editable()) {
            var node = this.mind.get_node(node_id);
            if (!!node) {
                if (!!image) {
                    node.data['background-image'] = image;
                }
                if (!!width) {
                    node.data['width'] = width;
                }
                if (!!height) {
                    node.data['height'] = height;
                }
                if (!!rotation) {
                    node.data['background-rotation'] = rotation;
                }
                this.view.reset_node_custom_style(node);
                this.view.update_node(node);
                this.layout.layout();
                this.view.show(false);
            }
        } else {
            logger.error('fail, this mind map is not editable');
            return null;
        }
    }
    /**
     * @param {string} node_id
     * @param {number} rotation
     * @returns {void}
     */
    set_node_background_rotation(node_id, rotation) {
        if (this.get_editable()) {
            var node = this.mind.get_node(node_id);
            if (!!node) {
                if (!node.data['background-image']) {
                    logger.error(
                        'fail, only can change rotation angle of node with background image'
                    );
                    return null;
                }
                node.data['background-rotation'] = rotation;
                this.view.reset_node_custom_style(node);
                this.view.update_node(node);
                this.layout.layout();
                this.view.show(false);
            }
        } else {
            logger.error('fail, this mind map is not editable');
            return null;
        }
    }
    /** trigger view resize */
    resize() {
        this.view.resize();
    }
    // callback(type ,data)
    /** @param {(type:number, data: EventData)=>void} callback */
    add_event_listener(callback) {
        if (typeof callback === 'function') {
            this.event_handles.push(callback);
        }
    }
    /** clear event listeners */
    clear_event_listener() {
        this.event_handles = [];
    }
    /** @param {number} type @param {EventData} data */
    invoke_event_handle(type, data) {
        var j = this;
        $.w.setTimeout(function () {
            j._invoke_event_handle(type, data);
        }, 0);
    }
    /** @param {number} type @param {EventData} data */
    _invoke_event_handle(type, data) {
        var l = this.event_handles.length;
        for (var i = 0; i < l; i++) {
            this.event_handles[i](type, data);
        }
    }

    /**
     * Remove an enhanced plugin
     * @param {typeof EnhancedPlugin} PluginClass - Plugin class
     */
    removePlugin(PluginClass) {
        if (this.enhancedPluginManager) {
            this.enhancedPluginManager.removePlugin(PluginClass);
        }
    }

    /**
     * Get an enhanced plugin instance
     * @param {string} instanceName - Plugin instance name
     * @returns {EnhancedPlugin | undefined}
     */
    getPlugin(instanceName) {
        if (this.enhancedPluginManager) {
            return this.enhancedPluginManager.getPlugin(instanceName);
        }
        return undefined;
    }

    /**
     * Destroy the jsMind instance and clean up resources
     */
    destroy() {
        // Destroy enhanced plugins
        if (this.enhancedPluginManager) {
            this.enhancedPluginManager.destroyAllPlugins();
        }

        // Clear event listeners
        this.clear_event_listener();

        // Clean up view
        if (this.view) {
            this.view.reset();
        }

        // Clear mind data
        this.mind = null;
        this.initialized = false;
    }

    /**
     * Deprecated: static show constructor helper.
     * @param {import('./jsmind.option.js').JsMindRuntimeOptions} options
     * @param {object | null} mind
     * @returns {jsMind}
     */
    static show(options, mind) {
        logger.warn(
            '`jsMind.show(options, mind)` is deprecated, please use `jm = new jsMind(options); jm.show(mind);` instead'
        );
        var _jm = new jsMind(options);
        _jm.show(mind);
        return _jm;
    }
}
