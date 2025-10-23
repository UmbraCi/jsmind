/**
 * @license BSD
 *
 * HistoryPlugin (EnhancedPlugin)
 * Undo/Redo & History stack for jsMind with public APIs and future diff support.
 * This is the initial skeleton (Task 1): preload plugin, mount jm.history with no-op methods.
 */

import jsMind from '@umbraci/jsmind';
import { EnhancedPlugin } from '../../jsmind.enhanced-plugin.js';
import { logger } from '../../jsmind.common.js';
import { diff as diffSnapshots } from './history-diff.js';

/**
 * @typedef {import('../../jsmind.js').default} JsMind
 */

const DEFAULT_OPTIONS = {
    enabled: true,
    throttleMs: 100,
    maxHistory: 500,
    keymap: { enabled: false, redoUsesY: false },
    detail: { enabled: false },
    diff: { flat: true, fields: undefined, maxSize: 5000 },
};

/**
 * Normalize and freeze options (shallow)
 */
function normalizeOptions(opt) {
    const o = Object.assign({}, DEFAULT_OPTIONS, opt || {});
    if (!o.keymap) o.keymap = { enabled: false, redoUsesY: false };
    if (!o.detail) o.detail = { enabled: false };
    if (!o.diff) o.diff = { flat: true, fields: undefined, maxSize: 5000 };
    return o;
}

/**
 * HistoryPlugin skeleton (Task 1)
 */
class HistoryPlugin extends EnhancedPlugin {
    static instanceName = 'historyPlugin';
    static preload = true;

    /**
     * @param {{ jm: JsMind, pluginOpt?: any }} params
     */
    constructor({ jm, pluginOpt }) {
        super({ jm, pluginOpt });
        this.options = normalizeOptions(pluginOpt);

        // In preload stage, core providers may not be ready. Only mount API.
        this._mounted = false;
        this._core = null;
        this._mountAPI();

        // Prepare core after jm providers are ready (later tasks may rebind events)
        // Here we set up functional methods for Task 2 (HistoryCore minimal implementation)
        this._initCore();
    }

    /** Initialize HistoryCore and wire API methods */
    _initCore() {
        const jm = this.jm;
        const opt = this.options;

        // Inject shortcut mapping in preload phase so ShortcutProvider can pick them up in init()
        if (opt.keymap && opt.keymap.enabled && jm.options && jm.options.shortcut) {
            this._injectShortcuts(jm.options.shortcut, !!opt.keymap.redoUsesY);
        }

        const core = new HistoryCore(jm, opt);
        this._core = core;

        if (!jm.history) return; // should exist after _mountAPI

        // Wire real implementations
        jm.history.add = (reason, meta) => core.add(reason, meta);
        jm.history.pause = () => core.pause();
        jm.history.resume = flush => core.resume(!!flush);
        jm.history.clear = () => core.clear();

        jm.history.canBack = () => core.canBack();
        jm.history.canForward = () => core.canForward();
        jm.history.back = steps => core.back(typeof steps === 'number' ? steps : 1);
        jm.history.forward = steps => core.forward(typeof steps === 'number' ? steps : 1);

        jm.history.length = () => core.length();
        jm.history.index = () => core.index();
        jm.history.setMax = count => core.setMax(count);
        jm.history.setThrottle = ms => core.setThrottle(ms);

        jm.history.exportSnapshot = () => core.exportSnapshot();
        jm.history.importSnapshot = (data, applyOptions) => core.importSnapshot(data, applyOptions);
        jm.history.getStack = () => core.getStackMeta();
        jm.history.diff = (a, b, opts) => diffSnapshots(a, b, opts);

        // Bind events: seed initial snapshot after first show(), and capture edits
        this._seededInitial = false;
        this._listener = (type, payload) => {
            try {
                // Seed once on the first show() completion (payload carries data)
                if (!this._seededInitial && type === jsMind.event_type.show && payload && ('data' in payload)) {
                    core.clear();
                    try { core._addNow && core._addNow('bootstrap'); } catch (e) {}
                    this._seededInitial = true;
                    return;
                }
                // Capture standard edit operations
                if (type === jsMind.event_type.edit && payload && payload.evt) {
                    core.add(payload.evt, payload);
                }
            } catch (e) {
                logger.warn('[history] listener error', e);
            }
        };
        jm.add_event_listener(this._listener);
    }

    /**
     * Inject shortcut options so provider can register mapping in its init phase
     * @param {{ enable?: boolean, handles: Record<string,Function>, mapping: Record<string, number|number[]> }} sc
     * @param {boolean} redoUsesY
     */
    _injectShortcuts(sc, redoUsesY) {
        // Build key codes as ShortcutProvider expects
        const CTRL = 1 << 12,
            META = 1 << 13,
            SHIFT = 1 << 10;
        const Z = 90,
            Y = 89;
        const backKeys = [CTRL + Z, META + Z];
        const forwardKeys = redoUsesY ? [CTRL + Y, META + Y] : [CTRL + SHIFT + Z, META + SHIFT + Z];

        sc.handles['history_back'] = (jm, e) => {
            if (jm.history && jm.history.back()) {
                e.preventDefault();
                e.stopPropagation && e.stopPropagation();
            }
        };
        sc.handles['history_forward'] = (jm, e) => {
            if (jm.history && jm.history.forward()) {
                e.preventDefault();
                e.stopPropagation && e.stopPropagation();
            }
        };
        sc.mapping['history_back'] = backKeys;
        sc.mapping['history_forward'] = forwardKeys;
    }

    /** Mount public API on jm.history (placeholder defaults) */
    _mountAPI() {
        if (this._mounted) return;
        const jm = this.jm;

        // Public surface designed by requirements; will be wired to core in _initCore.
        const api = {
            // control & stack
            add: () => undefined,
            pause: () => undefined,
            resume: _flush => undefined,
            clear: () => undefined,

            // navigation
            canBack: () => false,
            canForward: () => false,
            back: _steps => false,
            forward: _steps => false,

            // info/config
            length: () => 0,
            index: () => -1,
            setMax: _count => undefined,
            setThrottle: _ms => undefined,

            // snapshots
            exportSnapshot: () => null,
            importSnapshot: (_data, _opts) => undefined,

            // stack & diff (wired in _initCore)
            getStack: () => ({ items: [], index: -1 }),
            diff: (a, b, opts) => diffSnapshots(a, b, opts),

            // options getter (read-only view)
            getOptions: () => Object.assign({}, this.options),
        };

        Object.defineProperty(jm, 'history', {
            value: api,
            configurable: true,
            enumerable: false,
            writable: false,
        });
        this._mounted = true;
        logger.info('[history] API mounted (preload).');
    }

    /** Cleanup before plugin removed */
    beforePluginRemove() {
        try {
            // detach event listener if possible
            if (this._listener && this.jm && Array.isArray(this.jm.event_handles)) {
                const idx = this.jm.event_handles.indexOf(this._listener);
                if (idx >= 0) this.jm.event_handles.splice(idx, 1);
            }

            if (this.jm && Object.prototype.hasOwnProperty.call(this.jm, 'history')) {
                // remove mounted API
                // @ts-ignore - JM is JS runtime
                delete this.jm.history;
            }
            this._mounted = false;
        } catch (e) {
            logger.error('[history] remove failed:', e);
        }
    }

    /** Default: call beforePluginRemove on destroy */
    beforePluginDestroy() {
        this.beforePluginRemove();
    }
}

// ---------------- HistoryCore (Task 2 minimal implementation) ----------------
class HistoryCore {
    /** @param {JsMind} jm @param {any} options */
    constructor(jm, options) {
        this.jm = jm;
        this.options = options;
        this.enabled = !!options.enabled;
        this.maxHistory = Math.max(1, options.maxHistory | 0);
        this.throttleMs = Math.max(0, options.throttleMs | 0);

        this._history = []; // of frozen snapshot objects
        this._idx = -1;
        this._paused = false;
        this._lastAddAt = 0;
        this._timer = 0;
        this._pending = false;
        this._pendingMeta = undefined;
        this._lastSig = null; // last snapshot JSON signature for dedupe

        // Defer initial snapshot seeding to first EventType.show (post-show)
        // Avoid calling _addNow here because providers are not ready in preload stage.
    }

    // ----- public API wrappers -----
    add(reason = 'manual', meta) {
        if (!this.enabled || this._paused) return;
        const now = Date.now();
        const elapsed = now - this._lastAddAt;
        if (elapsed >= this.throttleMs) {
            this._addNow(reason, meta);
            this._lastAddAt = Date.now();
            return;
        }
        // schedule a coalesced add
        this._pending = true;
        this._pendingMeta = meta;
        if (this._timer) return;
        const delay = Math.max(0, this.throttleMs - elapsed);
        this._timer = setTimeout(() => {
            this._timer = 0;
            if (!this._paused && this.enabled) {
                this._addNow(reason, this._pendingMeta);
                this._lastAddAt = Date.now();
            }
            this._pending = false;
            this._pendingMeta = undefined;
        }, delay);
    }
    pause() {
        this._paused = true;
    }
    resume(flush = false) {
        this._paused = false;
        if (flush && this._pending) {
            clearTimeout(this._timer);
            this._timer = 0;
            this._addNow('resume-flush', this._pendingMeta);
            this._lastAddAt = Date.now();
            this._pending = false;
            this._pendingMeta = undefined;
        }
    }
    clear() {
        this._history = [];
        this._idx = -1;
        this._lastSig = null;
    }
    canBack() {
        return this._idx > 0;
    }
    canForward() {
        return this._idx >= 0 && this._idx < this._history.length - 1;
    }
    back(steps = 1) {
        if (!Number.isFinite(steps) || steps <= 0) steps = 1;
        if (this._idx - steps < 0) return false;
        this._idx -= steps;
        return this._applyIndex();
    }
    forward(steps = 1) {
        if (!Number.isFinite(steps) || steps <= 0) steps = 1;
        if (this._idx + steps >= this._history.length) return false;
        this._idx += steps;
        return this._applyIndex();
    }
    length() {
        return this._history.length;
    }
    index() {
        return this._idx;
    }
    setMax(count) {
        this.maxHistory = Math.max(1, count | 0);
    }
    setThrottle(ms) {
        this.throttleMs = Math.max(0, ms | 0);
    }
    exportSnapshot() {
        return this._takeSnapshot();
    }
    importSnapshot(data, applyOptions) {
        return this._applySnapshot(data, applyOptions);
    }
    getStackMeta() {
        return { items: this._history.slice(), index: this._idx };
    }

    // ----- internals -----
    _addNow(_reason, _meta) {
        const snapshot = this._takeSnapshot();
        // Compute signature for dedupe against last snapshot (avoid storing strings)
        let sig = null;
        try { sig = JSON.stringify(snapshot) } catch {}
        if (sig && this._lastSig && sig === this._lastSig) return; // dedupe

        // trim future
        if (this._idx < this._history.length - 1)
            this._history = this._history.slice(0, this._idx + 1);

        // push with cap
        if (this._history.length >= this.maxHistory) {
            this._history.shift();
            this._idx = Math.max(-1, this._idx - 1);
        }
        const frozen = this._deepFreeze(snapshot);
        this._history.push(frozen);
        this._idx = this._history.length - 1;
        this._lastSig = sig;
    }

    _applyIndex() {
        const snap = this._history[this._idx];
        if (!snap) return false;
        try {
            const data = this._cloneSnapshot(snap);
            this._applySnapshot(data, { skipCentering: true });
            try { this._lastSig = JSON.stringify(snap) } catch { this._lastSig = null }
            return true;
        } catch (e) {
            logger.error('[history] apply snapshot failed', e);
            return false;
        }
    }

    _takeSnapshot() {
        return this.jm.get_data('node_tree');
    }
    _applySnapshot(data, applyOptions) {
        const skip = !!(applyOptions && applyOptions.skipCentering);
        this.jm.show(data, skip);
        return true;
    }

    _deepFreeze(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        if (Object.isFrozen(obj)) return obj;
        Object.freeze(obj);
        if (Array.isArray(obj)) { for (const v of obj) this._deepFreeze(v) }
        else { for (const k of Object.keys(obj)) this._deepFreeze(obj[k]) }
        return obj;
    }

    _cloneSnapshot(obj) {
        // Prefer structuredClone when available to avoid JSON pitfalls
        if (typeof structuredClone === 'function') {
            try { return structuredClone(obj) } catch {}
        }
        try { return JSON.parse(JSON.stringify(obj)) } catch { return obj }
    }
}

export default HistoryPlugin;
export { HistoryPlugin };
