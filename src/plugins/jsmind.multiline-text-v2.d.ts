/**
 * @license BSD
 * @copyright 2014-2025 UmbraCi
 *
 * Project Home:
 *   https://github.com/UmbraCi/jsmind/
 */

import type jsMind from '../jsmind.js';
import type { EnhancedPlugin } from '../jsmind.enhanced-plugin.js';
import type { Node } from '../jsmind.node.js';

/**
 * MultilineTextV2 plugin options
 */
export interface MultilineTextV2Options {
    /** Maximum text width in pixels */
    text_width?: number;
    /** Minimum editor height in pixels */
    min_height?: number;
    /** Line height (CSS value) */
    line_height?: string;
    /** Editor border color */
    editor_border_color?: string;
    /** Editor border width */
    editor_border_width?: string;
    /** Auto-resize editor as user types */
    auto_resize?: boolean;
}

/**
 * MultilineTextV2 Plugin
 * Enhanced multiline text plugin using the new plugin system
 */
export class MultilineTextV2 extends EnhancedPlugin {
    /** Plugin instance name */
    static instanceName: 'multilineTextV2';
    /** Whether to preload */
    static preload: false;

    /** Plugin options */
    options: Required<MultilineTextV2Options>;
    /** Currently editing node */
    editing_node: Node | null;
    /** Multiline editor element */
    multiline_editor: HTMLTextAreaElement | null;

    /**
     * Create plugin instance
     * @param params - Plugin parameters
     * @param params.jm - jsMind instance
     * @param params.pluginOpt - Plugin options
     */
    constructor(params: { jm: jsMind; pluginOpt?: MultilineTextV2Options });

    /**
     * Setup custom rendering for multiline text
     */
    setupCustomRender(): void;

    /**
     * Begin editing a node
     * @param node - Node to edit
     */
    edit_node_begin(node: Node): void;

    /**
     * End editing a node
     */
    edit_node_end(): void;

    /**
     * Called before plugin is removed
     */
    beforePluginRemove(): void;

    /**
     * Called before jsMind instance is destroyed
     */
    beforePluginDestroy(): void;
}

export default MultilineTextV2;

