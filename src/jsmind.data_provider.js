/**
 * @license BSD
 * @copyright 2014-2025 UmbraCi
 *
 * Project Home:
 *   https://github.com/UmbraCi/jsmind/
 */

import { logger } from './jsmind.common.js';
import { format } from './jsmind.format.js';

export class DataProvider {
    /**
     * Data provider: loads and serializes mind data by format.
     * @param {import('./jsmind.js').default} jm - jsMind instance
     */
    constructor(jm) {
        this.jm = jm;
    }

    /** Initialize data provider. */
    init() {
        logger.debug('data.init');
    }
    /** Reset data provider state. */
    reset() {
        logger.debug('data.reset');
    }
    /**
     * Load a Mind from mixed source.
     * @param {import('./jsmind.format.js').NodeTreeFormat|import('./jsmind.format.js').NodeArrayFormat|{meta?:{name:string,author:string,version:string},format:'freemind',data:string}|{meta?:{name:string,author:string,version:string},format:'text',data:string}} mind_data - object with {format,data} or a format-specific payload
     * @returns {import('./jsmind.mind.js').Mind|null}
     */
    load(mind_data) {
        var df = null;
        var mind = null;
        if (typeof mind_data === 'object') {
            if (!!mind_data.format) {
                df = mind_data.format;
            } else {
                df = 'node_tree';
            }
        } else {
            df = 'freemind';
        }

        const fieldNames = this.jm && this.jm.options ? this.jm.options.fieldNames : undefined;
        const getMind = parser =>
            typeof fieldNames === 'undefined' ? parser.get_mind(mind_data) : parser.get_mind(mind_data, fieldNames);
        if (df == 'node_array') {
            mind = getMind(format.node_array);
        } else if (df == 'node_tree') {
            mind = getMind(format.node_tree);
        } else if (df == 'freemind') {
            mind = getMind(format.freemind);
        } else if (df == 'text') {
            mind = getMind(format.text);
        } else {
            logger.warn('unsupported format');
        }
        return mind;
    }
    /**
     * Serialize current mind to target format.
     * @param {'node_tree'|'node_array'|'freemind'|'text'} data_format
     * @returns {import('./jsmind.format.js').NodeTreeFormat|import('./jsmind.format.js').NodeArrayFormat|{meta:{name:string,author:string,version:string},format:'freemind',data:string}|{meta:{name:string,author:string,version:string},format:'text',data:string}}
     */
    get_data(data_format) {
        var data = null;
        const fieldNames = this.jm && this.jm.options ? this.jm.options.fieldNames : undefined;
        const getData = parser =>
            typeof fieldNames === 'undefined' ? parser.get_data(this.jm.mind) : parser.get_data(this.jm.mind, fieldNames);
        if (data_format == 'node_array') {
            data = getData(format.node_array);
        } else if (data_format == 'node_tree') {
            data = getData(format.node_tree);
        } else if (data_format == 'freemind') {
            data = format.freemind.get_data(this.jm.mind);
        } else if (data_format == 'text') {
            data = format.text.get_data(this.jm.mind);
        } else {
            logger.error('unsupported ' + data_format + ' format');
        }
        return data;
    }
}
