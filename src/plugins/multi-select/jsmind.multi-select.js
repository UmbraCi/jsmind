/**
 * @license BSD
 * @copyright 2014-2025 UmbraCi
 *
 * Project Home:
 *   https://github.com/UmbraCi/jsmind/
 */

import { Plugin } from '../../jsmind.plugin.js';
import { EventType, logger } from '../../jsmind.common.js';

/**
 * @typedef {Object} MultiSelectOptions
 * @property {boolean} [enable_multi_select=false] - Enable multi-select feature
 * @property {boolean} [enable_ctrl_key_node_selection=true] - Enable Ctrl/Cmd + click toggle
 * @property {boolean} [enable_box_selection=true] - Enable box selection
 * @property {boolean} [use_left_key_selection_right_key_drag=false] - true: left mouse drag; false: Ctrl/Cmd + right drag
 * @property {boolean} [shift_simple_mode] - Deprecated; no effect
 * @property {boolean} [include_descendants] - Deprecated; no effect
 */

const DEFAULT_OPTIONS = {
    enable_multi_select: false,
    enable_ctrl_key_node_selection: true,
    enable_box_selection: true,
    use_left_key_selection_right_key_drag: false,
};

class MultiSelectState {
    constructor(jm) {
        this.jm = jm;
        this._mode = null;
        this._last_selected_node = null;
        this._marked_ids = new Set();
        this._ensure_state();
    }

    _ensure_state() {
        if (!this.jm.mind) {
            this.jm.mind = {};
        }
        if (!this.jm.mind.selected_nodes) {
            this.jm.mind.selected_nodes = new Set();
        }
    }

    _resolve_node(node) {
        if (!node) {
            return null;
        }
        return typeof node === 'string' ? this.jm.get_node(node) : node;
    }

    _is_visible(node) {
        return !!(node && this.jm.layout && this.jm.layout.is_visible(node));
    }

    _derive_mode() {
        this._ensure_state();
        const size = this.jm.mind.selected_nodes.size;
        if (size === 0) {
            return null;
        }
        return size === 1 ? 'single' : 'multi';
    }

    _set_focus(node) {
        this.jm.mind.selected = node || null;
        if (this.jm.view) {
            this.jm.view.selected_node = node || null;
        }
        this._last_selected_node = node || null;
    }

    _mark_node(node) {
        if (!node) {
            return;
        }
        const element = node._data && node._data.view && node._data.view.element;
        if (!element) {
            return;
        }
        if (element.classList) {
            element.classList.add('selected');
        } else if (!/(\s|^)selected(\s|$)/.test(element.className)) {
            element.className += ' selected';
        }
        this._marked_ids.add(node.id);
    }

    _unmark_node(node) {
        if (!node) {
            return;
        }
        const element = node._data && node._data.view && node._data.view.element;
        if (element) {
            if (element.classList) {
                element.classList.remove('selected');
            } else {
                element.className = element.className.replace(/\s*selected\b/i, '');
            }
        }
        this._marked_ids.delete(node.id);
    }

    _sync_view_from_state() {
        this._ensure_state();

        const selected_ids = new Set();
        const selected_nodes = Array.from(this.jm.mind.selected_nodes);
        for (let i = 0; i < selected_nodes.length; i++) {
            selected_ids.add(selected_nodes[i].id);
        }

        const stale_ids = [];
        this._marked_ids.forEach(id => {
            if (!selected_ids.has(id)) {
                stale_ids.push(id);
            }
        });
        for (let i = 0; i < stale_ids.length; i++) {
            const stale_node = this.jm.get_node(stale_ids[i]);
            if (stale_node) {
                this._unmark_node(stale_node);
            } else {
                this._marked_ids.delete(stale_ids[i]);
            }
        }

        for (let i = 0; i < selected_nodes.length; i++) {
            this._mark_node(selected_nodes[i]);
        }
    }

    _emit(evt, changedNodes, focusNode) {
        const nodeIds = (changedNodes || []).map(node => node.id);
        this.jm.invoke_event_handle(EventType.select, {
            evt,
            data: nodeIds,
            node: focusNode ? focusNode.id : null,
            nodes: nodeIds,
        });
    }

    get_selected_nodes() {
        this._ensure_state();
        return Array.from(this.jm.mind.selected_nodes).map(node => node.id);
    }

    get_selected_node_set() {
        this._ensure_state();
        return new Set(this.jm.mind.selected_nodes);
    }

    is_node_selected(node) {
        const nodeObj = this._resolve_node(node);
        if (!nodeObj) {
            return false;
        }
        this._ensure_state();
        return this.jm.mind.selected_nodes.has(nodeObj);
    }

    get_selection_mode() {
        return this._mode;
    }

    select_node(node) {
        const nodeObj = this._resolve_node(node);
        if (!this._is_visible(nodeObj)) {
            return;
        }

        this._ensure_state();
        const prev = Array.from(this.jm.mind.selected_nodes);

        this.jm.mind.selected_nodes.clear();
        this.jm.mind.selected_nodes.add(nodeObj);
        this._set_focus(nodeObj);
        this._mode = 'single';
        this._sync_view_from_state();

        const removed = prev.filter(n => n.id !== nodeObj.id);
        if (removed.length) {
            this._emit('multi_deselect', removed, nodeObj);
        }
        this._emit('select_node', [nodeObj], nodeObj);
    }

    select_clear() {
        this._ensure_state();
        if (this.jm.mind.selected_nodes.size === 0) {
            this._set_focus(null);
            this._mode = null;
            return;
        }

        const removed = Array.from(this.jm.mind.selected_nodes);
        this.jm.mind.selected_nodes.clear();
        this._set_focus(null);
        this._mode = null;
        this._sync_view_from_state();
        this._emit('clear_selection', removed, null);
    }

    toggle_node_selection(node) {
        const nodeObj = this._resolve_node(node);
        if (!this._is_visible(nodeObj)) {
            return;
        }

        this._ensure_state();
        if (this.jm.mind.selected_nodes.has(nodeObj)) {
            this.jm.mind.selected_nodes.delete(nodeObj);
            if (this.jm.mind.selected === nodeObj) {
                const remain = Array.from(this.jm.mind.selected_nodes);
                this._set_focus(remain.length ? remain[remain.length - 1] : null);
            }
            this._mode = this._derive_mode();
            this._sync_view_from_state();
            this._emit('multi_deselect', [nodeObj], this.jm.mind.selected || null);
            return;
        }

        this.jm.mind.selected_nodes.add(nodeObj);
        this._set_focus(nodeObj);
        this._mode = this._derive_mode();
        this._sync_view_from_state();
        this._emit('multi_select', [nodeObj], nodeObj);
    }

    set_selection(nodes, opts) {
        this._ensure_state();
        const options = opts || {};
        const normalized = [];
        const uniq = new Set();
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (!node || !this._is_visible(node) || uniq.has(node.id)) {
                continue;
            }
            uniq.add(node.id);
            normalized.push(node);
        }

        const prev = Array.from(this.jm.mind.selected_nodes);
        this.jm.mind.selected_nodes.clear();
        for (let i = 0; i < normalized.length; i++) {
            this.jm.mind.selected_nodes.add(normalized[i]);
        }

        const focus = options.focusNode || (normalized.length ? normalized[normalized.length - 1] : null);
        this._set_focus(focus);
        this._mode = this._derive_mode();
        this._sync_view_from_state();

        if (options.emit === false) {
            return;
        }

        const prevIds = new Set(prev.map(n => n.id));
        const nextIds = new Set(normalized.map(n => n.id));

        const added = normalized.filter(n => !prevIds.has(n.id));
        const removed = prev.filter(n => !nextIds.has(n.id));

        if (removed.length) {
            this._emit('multi_deselect', removed, focus);
        }
        if (added.length) {
            this._emit('multi_select', added, focus);
        }
        if (!added.length && !removed.length && focus && options.forceSelectEvent) {
            this._emit('select_node', [focus], focus);
        }
    }

    prune_removed(nodeIds) {
        this._ensure_state();
        if (!nodeIds || !nodeIds.length || this.jm.mind.selected_nodes.size === 0) {
            return;
        }

        const ids = new Set(nodeIds);
        const removed = [];
        this.jm.mind.selected_nodes.forEach(node => {
            if (ids.has(node.id)) {
                removed.push(node);
            }
        });
        if (!removed.length) {
            return;
        }

        for (let i = 0; i < removed.length; i++) {
            this.jm.mind.selected_nodes.delete(removed[i]);
        }

        if (this.jm.mind.selected && ids.has(this.jm.mind.selected.id)) {
            const remain = Array.from(this.jm.mind.selected_nodes);
            this._set_focus(remain.length ? remain[remain.length - 1] : null);
        }
        this._mode = this._derive_mode();
        this._sync_view_from_state();
        this._emit('multi_deselect', removed, this.jm.mind.selected || null);
    }
}

class SelectBox {
    constructor(jm, state, getOptions, isEnabled) {
        this.jm = jm;
        this.state = state;
        this.getOptions = getOptions;
        this.isEnabled = isEnabled;

        this._dragging = false;
        this._active = false;
        this._append_mode = false;
        this._base_selected = [];
        this._start_client = { x: 0, y: 0 };
        this._current_client = { x: 0, y: 0 };
        this._overlay = null;

        this._on_mouse_move = this._on_mouse_move.bind(this);
        this._on_mouse_up = this._on_mouse_up.bind(this);
    }

    is_selecting() {
        return this._dragging;
    }

    should_start(e) {
        if (!this.isEnabled()) {
            return false;
        }
        const options = this.getOptions();
        if (!options.enable_box_selection) {
            return false;
        }

        if (options.use_left_key_selection_right_key_drag) {
            return e.which === 1;
        }

        return (e.ctrlKey || e.metaKey) && e.which === 3;
    }

    start(e) {
        if (this._dragging) {
            return;
        }

        this._dragging = true;
        this._active = false;
        this._append_mode = !!(e.ctrlKey || e.metaKey);
        this._base_selected = Array.from(this.state.get_selected_node_set());
        this._start_client = { x: e.clientX, y: e.clientY };
        this._current_client = { x: e.clientX, y: e.clientY };

        if (!this._append_mode) {
            this.state.set_selection([], { emit: false });
        }

        this._ensure_overlay();
        this._update_overlay();
        document.addEventListener('mousemove', this._on_mouse_move, true);
        document.addEventListener('mouseup', this._on_mouse_up, true);
    }

    _ensure_overlay() {
        if (this._overlay) {
            return;
        }
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.pointerEvents = 'none';
        overlay.style.border = '1px solid #0984e3';
        overlay.style.background = 'rgba(9,132,227,0.2)';
        overlay.style.zIndex = '2147483000';
        overlay.style.display = 'none';
        document.body.appendChild(overlay);
        this._overlay = overlay;
    }

    _update_overlay() {
        if (!this._overlay) {
            return;
        }
        const x = Math.min(this._start_client.x, this._current_client.x);
        const y = Math.min(this._start_client.y, this._current_client.y);
        const w = Math.abs(this._start_client.x - this._current_client.x);
        const h = Math.abs(this._start_client.y - this._current_client.y);

        this._overlay.style.left = x + 'px';
        this._overlay.style.top = y + 'px';
        this._overlay.style.width = w + 'px';
        this._overlay.style.height = h + 'px';
        this._overlay.style.display = this._active ? 'block' : 'none';
    }

    _collect_nodes_in_rect() {
        if (!this.jm.mind || !this.jm.mind.nodes) {
            return [];
        }

        const x1 = Math.min(this._start_client.x, this._current_client.x);
        const y1 = Math.min(this._start_client.y, this._current_client.y);
        const x2 = Math.max(this._start_client.x, this._current_client.x);
        const y2 = Math.max(this._start_client.y, this._current_client.y);

        const values = Object.values(this.jm.mind.nodes);
        const selected = [];
        for (let i = 0; i < values.length; i++) {
            const node = values[i];
            if (!this.jm.layout.is_visible(node)) {
                continue;
            }
            const element = node._data && node._data.view && node._data.view.element;
            if (!element) {
                continue;
            }
            const rect = element.getBoundingClientRect();
            const overlap = !(rect.right < x1 || rect.left > x2 || rect.bottom < y1 || rect.top > y2);
            if (overlap) {
                selected.push(node);
            }
        }
        return selected;
    }

    _on_mouse_move(e) {
        if (!this._dragging) {
            return;
        }
        this._current_client = { x: e.clientX, y: e.clientY };
        const dx = Math.abs(this._start_client.x - this._current_client.x);
        const dy = Math.abs(this._start_client.y - this._current_client.y);
        this._active = dx > 4 || dy > 4;

        if (!this._active) {
            this._update_overlay();
            return;
        }

        const hitNodes = this._collect_nodes_in_rect();
        const merged = this._append_mode
            ? this._base_selected.concat(hitNodes.filter(node => !this._base_selected.find(n => n.id === node.id)))
            : hitNodes;

        this.state.set_selection(merged, {
            focusNode: merged.length ? merged[merged.length - 1] : null,
            emit: false,
        });
        this._update_overlay();

        e.preventDefault();
        e.stopPropagation();
    }

    _on_mouse_up(e) {
        if (!this._dragging) {
            return;
        }

        const wasActive = this._active;
        this._dragging = false;
        this._active = false;
        this._base_selected = [];
        if (this._overlay) {
            this._overlay.style.display = 'none';
        }

        document.removeEventListener('mousemove', this._on_mouse_move, true);
        document.removeEventListener('mouseup', this._on_mouse_up, true);

        if (wasActive) {
            const current = Array.from(this.state.get_selected_node_set());
            this.state.set_selection(current, {
                focusNode: current.length ? current[current.length - 1] : null,
                emit: true,
            });
            e.preventDefault();
            e.stopPropagation();
        }
    }

    destroy() {
        this._dragging = false;
        document.removeEventListener('mousemove', this._on_mouse_move, true);
        document.removeEventListener('mouseup', this._on_mouse_up, true);
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay = null;
    }
}

class MultiSelectInteraction {
    constructor(jm, state, getOptions, isEnabled) {
        this.jm = jm;
        this.state = state;
        this.getOptions = getOptions;
        this.isEnabled = isEnabled;
        this.selectBox = new SelectBox(jm, state, getOptions, isEnabled);

        this._on_nodes_mousedown = this._on_nodes_mousedown.bind(this);
        this._on_panel_contextmenu = this._on_panel_contextmenu.bind(this);
    }

    bind() {
        if (!this.jm.view || !this.jm.view.e_nodes || !this.jm.view.e_panel) {
            logger.warn('[multiSelect] view is not ready, interaction skipped');
            return;
        }
        this.jm.view.e_nodes.addEventListener('mousedown', this._on_nodes_mousedown, true);
        this.jm.view.e_panel.addEventListener('contextmenu', this._on_panel_contextmenu, true);
    }

    _on_panel_contextmenu(e) {
        if (!this.isEnabled()) {
            return;
        }
        if (this.selectBox.is_selecting()) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    _on_nodes_mousedown(e) {
        if (!this.isEnabled()) {
            return;
        }

        const options = this.getOptions();
        const element = e.target || e.currentTarget;
        const nodeId = this.jm.view.get_binded_nodeid(element);
        const isNode = nodeId && this.jm.view.is_node(element);

        if (isNode) {
            if (options.enable_ctrl_key_node_selection && (e.ctrlKey || e.metaKey)) {
                this.state.toggle_node_selection(nodeId);
            } else {
                this.state.select_node(nodeId);
            }
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) {
                e.stopImmediatePropagation();
            }
            return;
        }

        if (!nodeId && this.selectBox.should_start(e)) {
            this.selectBox.start(e);
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) {
                e.stopImmediatePropagation();
            }
            return;
        }

        if (!nodeId && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
            this.state.select_clear();
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) {
                e.stopImmediatePropagation();
            }
        }
    }

    destroy() {
        if (this.jm.view && this.jm.view.e_nodes) {
            this.jm.view.e_nodes.removeEventListener('mousedown', this._on_nodes_mousedown, true);
        }
        if (this.jm.view && this.jm.view.e_panel) {
            this.jm.view.e_panel.removeEventListener('contextmenu', this._on_panel_contextmenu, true);
        }
        this.selectBox.destroy();
    }
}

export class MultiSelectPlugin extends Plugin {
    static instanceName = 'multiSelectPlugin';
    static preload = false;

    constructor({ jm, pluginOpt }) {
        super({ jm, pluginOpt });
        this.options = Object.assign({}, DEFAULT_OPTIONS, pluginOpt || {});
        this._enabled = !!this.options.enable_multi_select;

        this._state = new MultiSelectState(jm);
        this._interaction = new MultiSelectInteraction(
            jm,
            this._state,
            () => this.options,
            () => this._enabled
        );

        this._listener = (type, data) => {
            if (!this._enabled) {
                return;
            }
            if (type === EventType.show) {
                this._state.select_clear();
                return;
            }
            if (type === EventType.edit && data && data.evt === 'remove_node') {
                this._state.prune_removed(data.data || []);
            }
        };

        this._mountAPI();
        this.jm.add_event_listener(this._listener);
        this._interaction.bind();

        if (this._enabled && typeof this.jm.disable_event_handle === 'function') {
            this.jm.disable_event_handle('mousedown');
        }
    }

    _mountAPI() {
        const plugin = this;
        const api = {
            get_selected_nodes: () => plugin._state.get_selected_nodes(),
            is_node_selected: node => plugin._state.is_node_selected(node),
            select_node: node => plugin._state.select_node(node),
            select_clear: () => plugin._state.select_clear(),
            toggle_node_selection: node => plugin._state.toggle_node_selection(node),
            get_selection_mode: () => plugin._state.get_selection_mode(),
            getOptions: () => Object.assign({}, plugin.options, { enable_multi_select: plugin._enabled }),
            enable: () => plugin.setEnabled(true),
            disable: () => plugin.setEnabled(false),
            setEnabled: flag => plugin.setEnabled(flag),
            setOptions: partial => plugin.setOptions(partial),
        };

        Object.defineProperty(this.jm, 'multiSelect', {
            value: api,
            configurable: true,
            enumerable: false,
            writable: false,
        });
    }

    setEnabled(flag) {
        this._enabled = !!flag;
        this.options.enable_multi_select = this._enabled;
        if (this._enabled) {
            if (typeof this.jm.disable_event_handle === 'function') {
                this.jm.disable_event_handle('mousedown');
            }
        } else if (typeof this.jm.enable_event_handle === 'function') {
            this.jm.enable_event_handle('mousedown');
        }
    }

    setOptions(partial) {
        this.options = Object.assign({}, this.options, partial || {});
    }

    beforePluginRemove() {
        if (typeof this.jm.enable_event_handle === 'function') {
            this.jm.enable_event_handle('mousedown');
        }
        this._enabled = false;

        if (this._interaction) {
            this._interaction.destroy();
        }
        if (this._listener && this.jm && Array.isArray(this.jm.event_handles)) {
            const index = this.jm.event_handles.indexOf(this._listener);
            if (index >= 0) {
                this.jm.event_handles.splice(index, 1);
            }
        }

        if (this.jm && Object.prototype.hasOwnProperty.call(this.jm, 'multiSelect')) {
            delete this.jm.multiSelect;
        }
    }

    beforePluginDestroy() {
        this.beforePluginRemove();
    }
}

export const MultiSelectCore = MultiSelectState;
export { MultiSelectState, MultiSelectInteraction, SelectBox };
export default MultiSelectPlugin;
