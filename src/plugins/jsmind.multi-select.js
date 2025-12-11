/**
 * @license BSD
 * @copyright 2014-2025 UmbraCi
 *
 * Project Home:
 *   https://github.com/UmbraCi/jsmind/
 */

import {EnhancedPlugin} from '../jsmind.enhanced-plugin.js';
import {EventType, logger} from '../jsmind.common.js';

/**
 * Default options for multi-select plugin.
 * @typedef {Object} MultiSelectOptions
 * @property {boolean} [enable_multi_select=true] - Enable multi-select feature
 * @property {boolean} [include_descendants=true] - Include descendants in subtree selection
 * @property {boolean} [shift_simple_mode=false] - Shift mode: false=simple subtree, true=advanced range
 * @property {((node:import('../jsmind.node.js').Node)=>boolean)|null} [filter=null] - Node filter function
 */
const DEFAULT_OPTIONS = {
    enable_multi_select: false, // default off; can be enabled at runtime
    include_descendants: true,
    shift_simple_mode: false,
    allow_ctrl: true,
    allow_shift: true,
    filter: null,
};

/**
 * Multi-Select Core - Handles all multi-select logic
 */
class MultiSelectCore {
    /**
     * @param {import('../jsmind.js').default} jm - jsMind instance
     * @param {MultiSelectOptions} options - Plugin options
     */
    constructor(jm, options) {
        this.jm = jm;
        this.options = options;

        // Initialize selection state
        this._ensure_selection_state();

        this._selection_mode = null; // 'single' | 'multi' | null
        this._last_selected_node = null;
    }

    /**
     * Ensure selection state is initialized
     * @private
     */
    _ensure_selection_state() {
        if (!this.jm.mind) {
            this.jm.mind = {};
        }
        if (!this.jm.mind.selected_nodes) {
            this.jm.mind.selected_nodes = new Set();
        }

        if (!this.jm.view) {
            this.jm.view = {};
        }
        if (!this.jm.view.multi_selected_nodes) {
            this.jm.view.multi_selected_nodes = new Map();
        }
    }

    /**
     * Get all selected nodes
     * @returns {string[]} Array of selected node IDs
     */
    get_selected_nodes() {
        this._ensure_selection_state();
        if (!this.jm.mind || !this.jm.mind.selected_nodes) {
            return [];
        }
        return Array.from(this.jm.mind.selected_nodes).map(node => node.id);
    }

    /**
     * Check if a node is selected
     * @param {string|import('../jsmind.node.js').Node} node - Node ID or Node instance
     * @returns {boolean}
     */
    is_node_selected(node) {
        const nodeObj = this._resolve_node(node);
        if (!nodeObj || !this.jm.mind) {
            return false;
        }
        this._ensure_selection_state();
        return this.jm.mind.selected_nodes.has(nodeObj);
    }

    /**
     * Select a single node (clears other selections)
     * @param {string|import('../jsmind.node.js').Node} node - Node ID or Node instance
     */
    select_node(node) {
        const nodeObj = this._resolve_node(node);
        if (!nodeObj) {
            logger.error('[multiSelect] node not found: ' + node);
            return;
        }

        this._ensure_selection_state();

        // Clear selection state first
        this._clear_selection_state();

        // Ensure again after clear, in case mind was reset
        this._ensure_selection_state();

        if (!this.jm.mind || !this.jm.mind.selected_nodes) {
            logger.error('[multiSelect] jm.mind or selected_nodes is not available');
            return;
        }

        // Set selection state
        this.jm.mind.selected = nodeObj;
        this._last_selected_node = nodeObj;

        // Force add node to selection (since we just cleared it)
        if (!this.jm.mind.selected_nodes.has(nodeObj)) {
            this.jm.mind.selected_nodes.add(nodeObj);
        }

        // Mark node as selected in view
        this._mark_node_selected(nodeObj);

        this._selection_mode = 'single';

        // Always use nodeObj.id for event data
        const nodeIds = [nodeObj.id];

        // Invoke event with proper data structure
        this._invoke_select_event({
            evt: 'select_node',
            data: nodeIds,
            node: nodeObj.id,
            nodes: nodeIds,
        });
    }

    /**
     * Clear all selections
     */
    select_clear() {
        this._ensure_selection_state();
        if (this.jm.mind) {
            this.jm.mind.selected = null;
            this._last_selected_node = null;
            this._clear_selection_state();
        }
    }

    /**
     * Toggle node selection (equivalent to Ctrl/Cmd+Click)
     * @param {string|import('../jsmind.node.js').Node} node - Node ID or Node instance
     */
    toggle_node_selection(node) {
        const nodeObj = this._resolve_node(node);
        if (!nodeObj || !this.jm.layout.is_visible(nodeObj)) {
            return;
        }

        this._ensure_selection_state();
        if (this.jm.mind.selected_nodes.has(nodeObj)) {
            this._deselect_subtree(nodeObj);
        } else {
            this._selection_mode = 'multi';
            const added = this._append_selection([nodeObj]);
            if (added.length) {
                this.jm.mind.selected = nodeObj;
                this._last_selected_node = nodeObj;
                this._invoke_select_event({
                    evt: 'multi_select',
                    data: [nodeObj.id],
                    node: nodeObj.id,
                    nodes: [nodeObj.id],
                });
            }
        }
    }

    /**
     * Toggle subtree selection
     * @param {string|import('../jsmind.node.js').Node} node - Node ID or Node instance
     */
    toggle_subtree_selection(node, opts) {
        const nodeObj = this._resolve_node(node);
        if (!nodeObj) {
            logger.error('[multiSelect] node not found: ' + node);
            return;
        }

        if (!this.jm.layout.is_visible(nodeObj)) {
            return;
        }

        const includeDesc = (opts && typeof opts.include_descendants !== 'undefined')
            ? !!opts.include_descendants
            : this.options.include_descendants !== false; // default true

        this._ensure_selection_state();
        // If node is not selected or not in multi mode, select subtree
        if (!this.jm.mind.selected_nodes.has(nodeObj) || this._selection_mode !== 'multi') {
            this._selection_mode = 'multi';
            let nodes = this._collect_subtree_nodes(nodeObj, {
                includeChildren: includeDesc,
                respectFilter: true,
                skipRootFilter: true,
            });
            if (!nodes.length) {
                nodes = [nodeObj];
            }

            const added = this._append_selection(nodes, {focusNode: nodeObj});
            this._ensure_selection_state();
            const ancestors = nodeObj.parent && !this.jm.mind.selected_nodes.has(nodeObj.parent)
                ? this._ensure_ancestor_selection([nodeObj], nodeObj, {
                    requireAncestorChainSelected: true,
                })
                : [];
            const allAdded = added.concat(ancestors);

            if (allAdded.length) {
                this.jm.mind.selected = nodeObj;
                const nodeIds = allAdded.map(n => n.id);
                this._invoke_select_event({
                    evt: 'multi_select',
                    data: nodeIds,
                    node: nodeObj.id,
                    nodes: nodeIds,
                });
            }
        } else {
            // Deselect subtree
            let nodes = this._collect_subtree_nodes(nodeObj, {
                includeChildren: true,
                respectFilter: false,
                skipRootFilter: false,
            });
            if (!nodes.length) {
                nodes = [nodeObj];
            }

            const removed = this._remove_selection(nodes);
            if (removed.length) {
                if (this.jm.mind.selected && this.jm.mind.selected.id === nodeObj.id) {
                    this.jm.mind.selected = null;
                }
                this._selection_mode = this._derive_selection_mode();
                const nodeIds = removed.map(n => n.id);
                this._invoke_select_event({
                    evt: 'multi_deselect',
                    data: nodeIds,
                    node: nodeObj.id,
                    nodes: nodeIds,
                });
            }
        }
    }

    /**
     * Get current selection mode
     * @returns {'single'|'multi'|null}
     */
    get_selection_mode() {
        return this._selection_mode;
    }

    /**
     * Handle node click event
     * @param {Object} payload - Click event payload
     * @param {MouseEvent} payload.e - Mouse event
     * @param {string} payload.node - Node ID
     * @param {HTMLElement} payload.element - Node element
     * @param {string} payload.evt - Event type
     */
    _handle_node_click(payload) {
        const {e, node, element} = payload;
        if (!node || !element) {
            return;
        }

        // Ensure selection state is initialized
        this._ensure_selection_state();

        const mode = this._get_multi_select_mode(e);

        if (mode === 'ctrl') {
            // Ctrl/Cmd + Click: Toggle node selection
            this.toggle_node_selection(node);
        } else if (mode === 'shift') {
            // Shift + Click: Range selection
            const nodeObj = this.jm.get_node(node);
            if (!nodeObj) {
                logger.warn('[multiSelect] Node not found for shift selection: ' + node);
                return;
            }

            if (this.options.shift_simple_mode) {
                // Advanced range mode
                if (this.is_node_selected(node)) {
                    this._deselect_subtree(nodeObj);
                } else {
                    this._range_select_nodes(node);
                }
            } else {
                // Simple subtree mode
                if (this.is_node_selected(node)) {
                    this._deselect_subtree(nodeObj);
                } else {
                    const includeChildren = this.options.include_descendants !== false;
                    let nodes = this._collect_subtree_nodes(nodeObj, {
                        includeChildren: includeChildren,
                        respectFilter: true,
                        skipRootFilter: true,
                    });
                    if (!nodes.length) {
                        nodes = [nodeObj];
                    }

                    const added = this._append_selection(nodes, {focusNode: nodeObj});
                    if (added.length) {
                        this.jm.mind.selected = nodeObj;
                        this._last_selected_node = nodeObj;
                        this._selection_mode = this._derive_selection_mode();
                        const nodeIds = added.map(n => n.id);
                        this._invoke_select_event({
                            evt: 'multi_select',
                            data: nodeIds,
                            node: nodeObj.id,
                            nodes: nodeIds,
                        });
                    } else {
                        // Fallback: at least select the clicked node
                        this._ensure_selection_state();
                        if (!this.jm.mind.selected_nodes.has(nodeObj)) {
                            this.jm.mind.selected_nodes.add(nodeObj);
                            this._mark_node_selected(nodeObj);
                        }
                        this.jm.mind.selected = nodeObj;
                        this._last_selected_node = nodeObj;
                        this._selection_mode = this._derive_selection_mode();
                        this._invoke_select_event({
                            evt: 'multi_select',
                            data: [nodeObj.id],
                            node: nodeObj.id,
                            nodes: [nodeObj.id],
                        });
                    }
                }
            }
        } else {
            // Normal click - single select
            this.select_node(node);
        }
    }

    /**
     * Handle node removed event
     * @param {import('../jsmind.node.js').Node} node - Removed node
     */
    _handle_node_removed(node) {
        this._ensure_selection_state();
        if (this.jm.mind.selected_nodes.has(node)) {
            this.jm.mind.selected_nodes.delete(node);
        }
        if (this._last_selected_node && this._last_selected_node.id === node.id) {
            this._last_selected_node = null;
        }
        if (this.jm.view.multi_selected_nodes && this.jm.view.multi_selected_nodes.has(node.id)) {
            this._unmark_node_selected(node);
        }
    }

    /**
     * Get multi-select mode from event
     * @param {MouseEvent} e - Mouse event
     * @returns {'ctrl'|'shift'|null}
     */
    _get_multi_select_mode(e) {
        if (!e) {
            return null;
        }
        // Check shift key first (higher priority)
        if (this.options.allow_shift !== false && e.shiftKey === true) {
            return 'shift';
        }
        // Check ctrl/cmd key
        if (this.options.allow_ctrl !== false && (e.ctrlKey === true || e.metaKey === true)) {
            return 'ctrl';
        }
        return null;
    }

    /**
     * Append nodes to selection
     * @param {import('../jsmind.node.js').Node[]} nodes - Nodes to select
     * @param {Object} [options] - Options
     * @param {import('../jsmind.node.js').Node} [options.focusNode] - Focus node
     * @returns {import('../jsmind.node.js').Node[]} Actually added nodes
     */
    _append_selection(nodes, options) {
        if (!nodes || !nodes.length) {
            return [];
        }

        this._ensure_selection_state();
        if (!this.jm.mind || !this.jm.mind.selected_nodes) {
            logger.warn('[multiSelect] Cannot append selection: selected_nodes not available');
            return [];
        }

        const added = [];
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (!this.jm.mind.selected_nodes.has(node)) {
                this.jm.mind.selected_nodes.add(node);
                added.push(node);
            }
        }

        if (added.length) {
            const focusNode = options && options.focusNode ? options.focusNode : null;
            this._mark_nodes_selected(added, focusNode || added[added.length - 1]);
        }

        return added;
    }

    /**
     * Remove nodes from selection
     * @param {import('../jsmind.node.js').Node[]} nodes - Nodes to deselect
     * @returns {import('../jsmind.node.js').Node[]} Actually removed nodes
     */
    _remove_selection(nodes) {
        if (!nodes || !nodes.length) {
            return [];
        }

        this._ensure_selection_state();
        const removed = [];
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (this.jm.mind.selected_nodes.has(node)) {
                this.jm.mind.selected_nodes.delete(node);
                removed.push(node);
            }
        }

        if (removed.length) {
            this._unmark_nodes_selected(removed);
        }

        return removed;
    }

    /**
     * Deselect subtree
     * @param {import('../jsmind.node.js').Node} node - Root node of subtree
     */
    _deselect_subtree(node) {
        let nodes = this._collect_subtree_nodes(node, {
            includeChildren: true,
            respectFilter: false,
            skipRootFilter: false,
        });
        if (!nodes.length) {
            nodes = [node];
        }

        const removed = this._remove_selection(nodes);
        if (removed.length) {
            if (this.jm.mind.selected && this.jm.mind.selected.id === node.id) {
                this.jm.mind.selected = null;
            }
            this._selection_mode = this._derive_selection_mode();
            const nodeIds = removed.map(n => n.id);
            this._invoke_select_event({
                evt: 'multi_deselect',
                data: nodeIds,
                node: node.id,
                nodes: nodeIds,
            });
        }
    }

    /**
     * Clear selection state
     * @returns {import('../jsmind.node.js').Node[]} Removed nodes
     */
    _clear_selection_state() {
        this._ensure_selection_state();
        this._selection_mode = null;

        // Double check after ensure
        if (!this.jm.mind || !this.jm.mind.selected_nodes) {
            this._ensure_selection_state();
        }

        if (!this.jm.mind || !this.jm.mind.selected_nodes || this.jm.mind.selected_nodes.size === 0) {
            this._clear_all_selected_nodes_view();
            return [];
        }

        const nodes = Array.from(this.jm.mind.selected_nodes);
        this.jm.mind.selected_nodes.clear();
        this._unmark_nodes_selected(nodes);
        return nodes;
    }

    /**
     * Collect subtree nodes
     * @param {import('../jsmind.node.js').Node} node - Root node
     * @param {Object} options - Options
     * @param {boolean} [options.includeChildren=true] - Include children
     * @param {boolean} [options.respectFilter=false] - Respect filter
     * @param {boolean} [options.skipRootFilter=false] - Skip root filter
     * @returns {import('../jsmind.node.js').Node[]}
     */
    _collect_subtree_nodes(node, options) {
        const opts = options || {};
        const includeChildren = opts.includeChildren !== false;
        const respectFilter = !!opts.respectFilter;
        const skipRootFilter = !!opts.skipRootFilter;

        const filter = respectFilter ? this._get_selection_filter() : null;
        const result = [];

        const collect = (n, isRoot) => {
            let shouldInclude = true;
            if (filter && (!skipRootFilter || !isRoot)) {
                shouldInclude = filter(n) !== false;
            }

            if (shouldInclude) {
                result.push(n);
            }

            if (includeChildren && n.children) {
                for (let i = 0; i < n.children.length; i++) {
                    collect(n.children[i], false);
                }
            }
        };

        collect(node, true);
        return result;
    }

    /**
     * Ensure ancestor selection
     * @param {import('../jsmind.node.js').Node[]} nodes - Nodes
     * @param {import('../jsmind.node.js').Node} focusNode - Focus node
     * @param {Object} options - Options
     * @returns {import('../jsmind.node.js').Node[]}
     */
    _ensure_ancestor_selection(nodes, focusNode, options) {
        if (!nodes || !nodes.length) {
            return [];
        }

        this._ensure_selection_state();
        const requireAncestorChainSelected = !!(options && options.requireAncestorChainSelected);
        const added = [];
        const addedMap = Object.create(null);

        for (let i = 0; i < nodes.length; i++) {
            let parent = nodes[i].parent;
            if (!parent) {
                continue;
            }

            const path = [];
            let shouldAdd = !requireAncestorChainSelected;

            // Check if any ancestor is already selected
            while (parent) {
                if (this.jm.mind.selected_nodes.has(parent)) {
                    shouldAdd = true;
                    break;
                }
                path.push(parent);
                parent = parent.parent;
            }

            if (shouldAdd) {
                for (let j = 0; j < path.length; j++) {
                    const p = path[j];
                    if (!this.jm.mind.selected_nodes.has(p) && !addedMap[p.id]) {
                        added.push(p);
                        addedMap[p.id] = true;
                    }
                }
            }
        }

        if (!added.length) {
            return [];
        }

        const focus = focusNode || nodes[nodes.length - 1];
        return this._append_selection(added, {focusNode: focus});
    }

    /**
     * Get selection filter
     * @returns {Function|null}
     */
    _get_selection_filter() {
        if (this.options && typeof this.options.filter === 'function') {
            return this.options.filter;
        }
        return null;
    }

    /**
     * Range select nodes (advanced mode)
     * @param {string} nodeId - Target node ID
     */
    _range_select_nodes(nodeId) {
        const nodeObj = this._resolve_node(nodeId);
        if (!nodeObj || !this.jm.layout.is_visible(nodeObj)) {
            return;
        }

        this._ensure_selection_state();
        // If no selection, select subtree
        if (this.jm.mind.selected_nodes.size === 0) {
            let nodes = this._collect_subtree_nodes(nodeObj, {
                includeChildren: true,
                respectFilter: true,
                skipRootFilter: true,
            });
            if (!nodes.length) {
                nodes = [nodeObj];
            }

            const added = this._append_selection(nodes);
            if (added.length) {
                this.jm.mind.selected = nodeObj;
                this._last_selected_node = nodeObj;
                this._selection_mode = this._derive_selection_mode();
                const nodeIds = added.map(n => n.id);
                this._invoke_select_event({
                    evt: 'multi_select',
                    data: nodeIds,
                    node: nodeObj.id,
                    nodes: nodeIds,
                });
            }
            return;
        }

        // Find anchor node
        this._ensure_selection_state();
        const selectedArray = Array.from(this.jm.mind.selected_nodes);
        const anchor =
            this._last_selected_node && this.jm.mind.selected_nodes.has(this._last_selected_node)
                ? this._last_selected_node
                : selectedArray[0];

        // Find nodes between anchor and target
        const nodesBetween = this._find_nodes_between(anchor, nodeObj);
        if (!nodesBetween.length) {
            const nodes = [nodeObj];
            const added = this._append_selection(nodes);
            if (added.length) {
                this.jm.mind.selected = nodeObj;
                this._last_selected_node = nodeObj;
                this._selection_mode = this._derive_selection_mode();
                const nodeIds = added.map(n => n.id);
                this._invoke_select_event({
                    evt: 'multi_select',
                    data: nodeIds,
                    node: nodeObj.id,
                    nodes: nodeIds,
                });
            }
            return;
        }

        // Select all nodes between anchor and target
        this._ensure_selection_state();
        const toAdd = nodesBetween.filter(n => !this.jm.mind.selected_nodes.has(n));
        const added = this._append_selection(toAdd);
        if (added.length) {
            this.jm.mind.selected = nodeObj;
            this._last_selected_node = nodeObj;
            this._selection_mode = this._derive_selection_mode();
            const nodeIds = added.map(n => n.id);
            this._invoke_select_event({
                evt: 'multi_select',
                data: nodeIds,
                node: nodeObj.id,
                nodes: nodeIds,
            });
        }
    }

    /**
     * Find nodes between two nodes
     * @param {import('../jsmind.node.js').Node} from - Start node
     * @param {import('../jsmind.node.js').Node} to - End node
     * @returns {import('../jsmind.node.js').Node[]}
     */
    _find_nodes_between(from, to) {
        if (!from || !to) {
            return [];
        }

        // Collect all visible nodes in order
        const allNodes = [];
        const collect = node => {
            if (this.jm.layout.is_visible(node)) {
                allNodes.push(node);
            }
            if (node.children) {
                for (let i = 0; i < node.children.length; i++) {
                    collect(node.children[i]);
                }
            }
        };

        if (this.jm.mind && this.jm.mind.root) {
            collect(this.jm.mind.root);
        }

        // Find indices
        let fromIndex = -1;
        let toIndex = -1;
        for (let i = 0; i < allNodes.length; i++) {
            if (allNodes[i].id === from.id) {
                fromIndex = i;
            }
            if (allNodes[i].id === to.id) {
                toIndex = i;
            }
        }

        if (fromIndex === -1 || toIndex === -1) {
            return [];
        }

        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);
        return allNodes.slice(start, end + 1);
    }

    /**
     * Derive selection mode from current state
     * @returns {'single'|'multi'|null}
     */
    _derive_selection_mode() {
        this._ensure_selection_state();
        const count = this.jm.mind.selected_nodes.size;
        if (count === 0) {
            return null;
        }
        return count > 1 ? 'multi' : 'single';
    }

    /**
     * Mark nodes as selected in view
     * @param {import('../jsmind.node.js').Node[]} nodes - Nodes to mark
     * @param {import('../jsmind.node.js').Node} focusNode - Focus node
     */
    _mark_nodes_selected(nodes, focusNode) {
        if (nodes && nodes.length) {
            for (let i = 0; i < nodes.length; i++) {
                this._mark_node_selected(nodes[i]);
            }
            this.jm.view.selected_node = focusNode || nodes[nodes.length - 1];
        }
    }

    /**
     * Mark a node as selected in view
     * @param {import('../jsmind.node.js').Node} node - Node to mark
     */
    _mark_node_selected(node) {
        if (!node || this.jm.view.multi_selected_nodes.has(node.id)) {
            return;
        }

        const element = node._data && node._data.view && node._data.view.element;
        if (element) {
            if (element.classList) {
                element.classList.add('selected');
            } else if (!/(\s|^)selected(\s|$)/.test(element.className)) {
                element.className += ' selected';
            }
            this.jm.view.multi_selected_nodes.set(node.id, node);
        }
    }

    /**
     * Unmark nodes as selected in view
     * @param {import('../jsmind.node.js').Node[]} nodes - Nodes to unmark
     */
    _unmark_nodes_selected(nodes) {
        if (nodes && nodes.length) {
            for (let i = 0; i < nodes.length; i++) {
                this._unmark_node_selected(nodes[i]);
            }
        }
    }

    /**
     * Unmark a node as selected in view
     * @param {import('../jsmind.node.js').Node} node - Node to unmark
     */
    _unmark_node_selected(node) {
        if (node) {
            if (this.jm.view.multi_selected_nodes.has(node.id)) {
                const element = node._data && node._data.view && node._data.view.element;
                if (element) {
                    if (element.classList) {
                        element.classList.remove('selected');
                    } else {
                        element.className = element.className.replace(/\s*selected\b/i, '');
                    }
                }
                this.jm.view.multi_selected_nodes.delete(node.id);
            }
            if (this.jm.view.selected_node && this.jm.view.selected_node.id === node.id) {
                this.jm.view.selected_node = null;
            }
        }
    }

    /**
     * Clear all selected nodes view
     */
    _clear_all_selected_nodes_view() {
        this._ensure_selection_state();
        if (!this.jm.view.multi_selected_nodes || !this.jm.view.multi_selected_nodes.size) {
            if (this.jm.view) {
                this.jm.view.selected_node = null;
            }
            return;
        }

        const nodes = Array.from(this.jm.view.multi_selected_nodes.values());
        for (let i = 0; i < nodes.length; i++) {
            this._unmark_node_selected(nodes[i]);
        }
        if (this.jm.view) {
            this.jm.view.selected_node = null;
        }
    }

    /**
     * Invoke select event
     * @param {Object} data - Event data
     */
    _invoke_select_event(data) {
        try {
            // Ensure nodes is always an array
            if (!data.nodes) {
                data.nodes = data.data || [];
            }
            // Ensure data is always an array
            if (!data.data) {
                data.data = data.nodes || [];
            }
            this.jm.invoke_event_handle(EventType.select, data);
        } catch (e) {
            logger.warn('[multiSelect] failed to invoke select event', e);
        }
    }

    /**
     * Resolve node from ID or Node instance
     * @param {string|import('../jsmind.node.js').Node} node - Node ID or Node instance
     * @returns {import('../jsmind.node.js').Node|null}
     */
    _resolve_node(node) {
        if (!node) {
            return null;
        }
        if (typeof node === 'string') {
            return this.jm.get_node(node);
        }
        return node;
    }
}

/**
 * Multi-Select Plugin - Enhanced plugin for jsMind
 */
export class MultiSelectPlugin extends EnhancedPlugin {
    static instanceName = 'multiSelectPlugin';
    static preload = false;

    /**
     * @param {{ jm: import('../jsmind.js').default, pluginOpt: object }} params
     */
    constructor({jm, pluginOpt}) {
        super({jm, pluginOpt});

        const options = Object.assign({}, DEFAULT_OPTIONS, pluginOpt || {});
        this.options = options;
        this._mounted = false;
        this._core = null;
        this._listener = null;
        this._enabled = !!options.enable_multi_select; // runtime gate

        this._initCore();
    }

    /**
     * Initialize core and mount API
     */
    _initCore() {
        const jm = this.jm;
        const options = this.options;
        const plugin = this; // Save reference for closure

        // Create core instance
        this._core = new MultiSelectCore(jm, options);

        // Mount API
        this._mountAPI();

        // Setup event listener
        this._listener = (type, data) => {
            try {
                if (type === EventType.show) {
                    plugin._core.select_clear();
                }
            } catch (e) {
                logger.warn('[multiSelect] listener error', e);
            }
        };

        jm.add_event_listener(this._listener);

        // Patch core selection APIs to route through plugin to avoid duplicate events
        this._original_select_node = jm.select_node.bind(jm);
        this._original_select_clear = jm.select_clear.bind(jm);
        jm.select_node = (node) => {
            // Route based on runtime gate
            if (plugin._enabled) return plugin._core.select_node(node);
            return plugin._original_select_node(node);
        };
        jm.select_clear = () => {
            if (plugin._enabled) return plugin._core.select_clear();
            return plugin._original_select_clear();
        };

        // Always bind our click handler once; gate controls interception
        const $ = jm.constructor.$;
        this._domClickHandler = function (e) {
            // Gate: only intercept when enabled
            if (!plugin._enabled) {
                return;
            }
            const element = e.target || e.currentTarget;
            const node_id = jm.view.get_binded_nodeid(element);

            // Only intercept jmnode, let expander clicks pass through
            if (node_id && jm.view.is_node(element)) {
                e.preventDefault();
                e.stopPropagation();
                if (e.stopImmediatePropagation) e.stopImmediatePropagation();

                plugin._core._handle_node_click({
                    e,
                    node: node_id,
                    element,
                    evt: 'click',
                });
            } else if (!node_id) {
                // Blank click without modifiers clears selection
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                    plugin._core.select_clear();
                }
            }
        };

        if (jm.view && jm.view.e_nodes) {
            $.on(jm.view.e_nodes, 'click', this._domClickHandler);
            logger.info('[multiSelect] plugin click handler attached');
        } else {
            logger.warn('[multiSelect] nodes container not ready; DOM handler not attached');
        }

        // Respect initial enabled state: toggle core default handler
        if (this._enabled && typeof jm.disable_event_handle === 'function') {
            jm.disable_event_handle('mousedown');
        }

        logger.info('[multiSelect] API mounted and event listener attached.');
    }

    /**
     * Mount API to jsMind instance
     */
    _mountAPI() {
        if (this._mounted) {
            return;
        }

        const jm = this.jm;
        const plugin = this; // Save reference for closure

        const api = {
            get_selected_nodes: () => {
                if (!plugin._core) {
                    logger.warn('[multiSelect] Core not initialized');
                    return [];
                }
                return plugin._core.get_selected_nodes();
            },
            is_node_selected: node => {
                if (!plugin._core) {
                    return false;
                }
                return plugin._core.is_node_selected(node);
            },
            select_node: node => {
                if (!plugin._core) {
                    logger.warn('[multiSelect] Core not initialized');
                    return;
                }
                plugin._core.select_node(node);
            },
            select_clear: () => {
                if (!plugin._core) {
                    return;
                }
                plugin._core.select_clear();
            },
            toggle_node_selection: node => {
                if (!plugin._core) {
                    logger.warn('[multiSelect] Core not initialized');
                    return;
                }
                plugin._core.toggle_node_selection(node);
            },
            toggle_subtree_selection: node => {
                if (!plugin._core) {
                    logger.warn('[multiSelect] Core not initialized');
                    return;
                }
                plugin._core.toggle_subtree_selection(node);
            },
            get_selection_mode: () => {
                if (!plugin._core) {
                    return null;
                }
                return plugin._core.get_selection_mode();
            },
            getOptions: () => {
                const base = plugin._core ? plugin._core.options : plugin.options;
                return Object.assign({}, base, {enable_multi_select: plugin._enabled});
            },
            enable: () => plugin.setEnabled(true),
            disable: () => plugin.setEnabled(false),
            setEnabled: (flag) => plugin.setEnabled(flag),
            setOptions: (partial) => plugin.setOptions(partial),
        };

        Object.defineProperty(jm, 'multiSelect', {
            value: api,
            configurable: true,
            enumerable: false,
            writable: false,
        });

        this._mounted = true;
        logger.info('[multiSelect] API mounted.');
    }

    /**
     * Cleanup before plugin removal
     */
    beforePluginRemove() {
        try {
            // Remove event listener
            if (this._listener && this.jm && Array.isArray(this.jm.event_handles)) {
                const index = this.jm.event_handles.indexOf(this._listener);
                if (index >= 0) {
                    this.jm.event_handles.splice(index, 1);
                }
            }

            // Re-enable core mousedown handle
            if (typeof this.jm.enable_event_handle === 'function') {
                this.jm.enable_event_handle('mousedown');
            }

            // Remove DOM click handler if attached
            if (this._domClickHandler && this.jm && this.jm.view && this.jm.view.e_nodes) {
                // No off() helper; leave it attached (noop when disabled). If needed, we could rebuild view.
                this._domClickHandler = null;
            }

            // Restore API wrappers
            if (this._original_select_node) {
                this.jm.select_node = this._original_select_node;
            }
            if (this._original_select_clear) {
                this.jm.select_clear = this._original_select_clear;
            }

            // Remove API namespace
            if (this.jm && Object.prototype.hasOwnProperty.call(this.jm, 'multiSelect')) {
                delete this.jm.multiSelect;
            }

            this._mounted = false;
        } catch (e) {
            logger.error('[multiSelect] remove failed:', e);
        }
    }

    // Runtime enable/disable and options update
    setEnabled(flag) {
        const next = !!flag;
        if (this._enabled === next) return;
        this._enabled = next;
        // Keep options in sync for getOptions()
        this.options.enable_multi_select = this._enabled;
        if (this._enabled) {
            if (typeof this.jm.disable_event_handle === 'function') {
                this.jm.disable_event_handle('mousedown');
            }
        } else {
            if (typeof this.jm.enable_event_handle === 'function') {
                this.jm.enable_event_handle('mousedown');
            }
        }
    }

    setOptions(partial) {
        const next = Object.assign({}, partial || {});
        // Update plugin-level options
        this.options = Object.assign({}, this.options, next);
        // Propagate to core so that _get_multi_select_mode sees changes
        if (this._core && this._core.options) {
            this._core.options = Object.assign({}, this._core.options, next);
        }
    }

    /**
     * Cleanup before plugin destroy
     */
    beforePluginDestroy() {
        logger.debug('[multiSelect] beforePluginDestroy');
        this.beforePluginRemove();
    }
}

// Export for compatibility
export {MultiSelectCore};
export default MultiSelectPlugin;

