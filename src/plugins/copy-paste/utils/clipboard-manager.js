/**
 * @license BSD-3-Clause
 * @copyright 2014-2025 hizzgdev@163.com
 *
 * Project Home:
 *   https://github.com/hizzgdev/jsmind/
 */

import { logger } from '../../../jsmind.common.js';

/**
 * 剪贴板管理器类
 * 处理系统剪贴板和内部剪贴板交互
 */
export class ClipboardManager {
    constructor(options = {}) {
        this.options = {
            // 是否使用系统剪贴板
            useSystemClipboard: true,
            // 剪贴板数据过期时间（毫秒）
            expireTime: 300000, // 5分钟
            // 最大剪贴板历史记录
            maxHistory: 10,
            // 是否自动清理过期数据
            autoCleanup: true,
            // 数据格式
            dataFormat: 'json',
            // 是否压缩数据
            compressData: false,
            ...options
        };

        this.logger = logger;
        this.clipboardHistory = [];
        this.currentData = null;
        this.currentTimestamp = 0;

        // 检查剪贴板API可用性
        this.isClipboardAPIAvailable = this.checkClipboardAPI();

        this.logger.info('ClipboardManager initialized', {
            systemClipboard: this.isClipboardAPIAvailable,
            options: this.options
        });
    }

    /**
     * 检查剪贴板API可用性
     * @returns {boolean} 是否可用
     */
    checkClipboardAPI() {
        return !!(navigator.clipboard &&
                 navigator.clipboard.readText &&
                 navigator.clipboard.writeText);
    }

    /**
     * 写入剪贴板
     * @param {*} data - 要写入的数据
     * @param {Object} options - 选项
     * @returns {Promise<boolean>} 是否成功
     */
    async write(data, options = {}) {
        try {
            const writeOptions = {
                addToHistory: true,
                useSystemClipboard: this.options.useSystemClipboard,
                ...options
            };

            // 准备数据
            const preparedData = this.prepareData(data);

            // 添加到历史记录
            if (writeOptions.addToHistory) {
                this.addToHistory(preparedData);
            }

            // 设置当前数据
            this.currentData = preparedData;
            this.currentTimestamp = Date.now();

            // 写入系统剪贴板
            if (writeOptions.useSystemClipboard && this.isClipboardAPIAvailable) {
                await this.writeToSystemClipboard(preparedData);
            }

            this.logger.debug('Data written to clipboard', {
                dataSize: preparedData.length,
                useSystemClipboard: writeOptions.useSystemClipboard
            });

            return true;
        } catch (error) {
            this.logger.error('Failed to write to clipboard:', error);
            return false;
        }
    }

    /**
     * 读取剪贴板
     * @param {Object} options - 选项
     * @returns {Promise<*>} 剪贴板数据
     */
    async read(options = {}) {
        try {
            const readOptions = {
                preferSystemClipboard: this.options.useSystemClipboard,
                fallbackToInternal: true,
                ...options
            };

            // 优先从系统剪贴板读取
            if (readOptions.preferSystemClipboard && this.isClipboardAPIAvailable) {
                const systemData = await this.readFromSystemClipboard();
                if (systemData !== null) {
                    return systemData;
                }
            }

            // 回退到内部剪贴板
            if (readOptions.fallbackToInternal && this.currentData) {
                // 检查数据是否过期
                if (!this.isDataExpired()) {
                    return this.currentData;
                } else {
                    this.logger.info('Clipboard data expired');
                    this.clear();
                }
            }

            return null;
        } catch (error) {
            this.logger.error('Failed to read from clipboard:', error);
            return null;
        }
    }

    /**
     * 清空剪贴板
     */
    clear() {
        this.currentData = null;
        this.currentTimestamp = 0;
        this.clipboardHistory = [];

        // 清空系统剪贴板
        if (this.isClipboardAPIAvailable) {
            this.writeToSystemClipboard('').catch(error => {
                this.logger.warn('Failed to clear system clipboard:', error);
            });
        }

        this.logger.debug('Clipboard cleared');
    }

    /**
     * 准备数据
     * @param {*} data - 原始数据
     * @returns {string} 准备后的数据
     */
    prepareData(data) {
        let preparedData;

        // 序列化数据
        try {
            if (typeof data === 'string') {
                preparedData = data;
            } else {
                preparedData = JSON.stringify(data, null, 0);
            }
        } catch (error) {
            this.logger.error('Failed to serialize data:', error);
            throw new Error('数据序列化失败');
        }

        // 压缩数据（如果需要）
        if (this.options.compressData && preparedData.length > 1000) {
            preparedData = this.compressData(preparedData);
        }

        // 添加元数据
        const metadata = {
            timestamp: Date.now(),
            format: this.options.dataFormat,
            compressed: this.options.compressData,
            size: preparedData.length
        };

        return this.wrapData(preparedData, metadata);
    }

    /**
     * 解析数据
     * @param {string} wrappedData - 包装后的数据
     * @returns {*} 解析后的数据
     */
    parseData(wrappedData) {
        try {
            // 解包数据
            const { data, metadata } = this.unwrapData(wrappedData);

            // 解压缩数据（如果需要）
            let parsedData = data;
            if (metadata.compressed) {
                parsedData = this.decompressData(data);
            }

            // 反序列化数据
            if (metadata.format === 'json') {
                return JSON.parse(parsedData);
            } else {
                return parsedData;
            }
        } catch (error) {
            this.logger.error('Failed to parse clipboard data:', error);
            throw new Error('数据解析失败');
        }
    }

    /**
     * 写入系统剪贴板
     * @param {string} data - 要写入的数据
     * @returns {Promise<void>}
     */
    async writeToSystemClipboard(data) {
        try {
            await navigator.clipboard.writeText(data);
            this.logger.debug('Data written to system clipboard');
        } catch (error) {
            this.logger.warn('Failed to write to system clipboard:', error);
            throw error;
        }
    }

    /**
     * 从系统剪贴板读取
     * @returns {Promise<string|null>} 读取的数据
     */
    async readFromSystemClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            this.logger.debug('Data read from system clipboard');
            return text;
        } catch (error) {
            this.logger.warn('Failed to read from system clipboard:', error);
            return null;
        }
    }

    /**
     * 添加到历史记录
     * @param {string} data - 数据
     */
    addToHistory(data) {
        // 检查是否与当前数据重复
        if (this.currentData && this.currentData === data) {
            return;
        }

        // 添加到历史记录
        this.clipboardHistory.unshift({
            data: data,
            timestamp: Date.now()
        });

        // 限制历史记录数量
        if (this.clipboardHistory.length > this.options.maxHistory) {
            this.clipboardHistory = this.clipboardHistory.slice(0, this.options.maxHistory);
        }

        this.logger.debug('Data added to clipboard history', {
            historySize: this.clipboardHistory.length
        });
    }

    /**
     * 获取历史记录
     * @returns {Array} 历史记录
     */
    getHistory() {
        return [...this.clipboardHistory];
    }

    /**
     * 从历史记录恢复
     * @param {number} index - 历史记录索引
     * @returns {boolean} 是否成功
     */
    restoreFromHistory(index) {
        if (index < 0 || index >= this.clipboardHistory.length) {
            return false;
        }

        const historyItem = this.clipboardHistory[index];
        this.currentData = historyItem.data;
        this.currentTimestamp = historyItem.timestamp;

        this.logger.debug('Restored from clipboard history', { index });

        return true;
    }

    /**
     * 检查数据是否过期
     * @returns {boolean} 是否过期
     */
    isDataExpired() {
        if (!this.currentTimestamp) {
            return true;
        }

        return Date.now() - this.currentTimestamp > this.options.expireTime;
    }

    /**
     * 压缩数据
     * @param {string} data - 要压缩的数据
     * @returns {string} 压缩后的数据
     */
    compressData(data) {
        // 简单的压缩实现，实际项目中可以使用更好的压缩算法
        try {
            return btoa(unescape(encodeURIComponent(data)));
        } catch (error) {
            this.logger.warn('Failed to compress data:', error);
            return data;
        }
    }

    /**
     * 解压缩数据
     * @param {string} compressedData - 压缩的数据
     * @returns {string} 解压缩后的数据
     */
    decompressData(compressedData) {
        try {
            return decodeURIComponent(escape(atob(compressedData)));
        } catch (error) {
            this.logger.warn('Failed to decompress data:', error);
            return compressedData;
        }
    }

    /**
     * 包装数据
     * @param {string} data - 数据
     * @param {Object} metadata - 元数据
     * @returns {string} 包装后的数据
     */
    wrapData(data, metadata) {
        const wrapper = {
            version: '1.0',
            source: 'jsmind-copy-paste-plugin',
            metadata: metadata,
            data: data
        };

        return JSON.stringify(wrapper);
    }

    /**
     * 解包数据
     * @param {string} wrappedData - 包装后的数据
     * @returns {Object} 解包后的数据
     */
    unwrapData(wrappedData) {
        try {
            const wrapper = JSON.parse(wrappedData);

            // 验证包装格式
            if (!wrapper.version || !wrapper.source || !wrapper.data) {
                throw new Error('Invalid clipboard data format');
            }

            return {
                data: wrapper.data,
                metadata: wrapper.metadata || {}
            };
        } catch (error) {
            // 如果解包失败，假设是原始数据
            return {
                data: wrappedData,
                metadata: {
                    format: 'raw',
                    compressed: false,
                    timestamp: Date.now()
                }
            };
        }
    }

    /**
     * 获取剪贴板状态
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            hasData: !!this.currentData,
            timestamp: this.currentTimestamp,
            isExpired: this.isDataExpired(),
            historySize: this.clipboardHistory.length,
            systemClipboardAvailable: this.isClipboardAPIAvailable,
            dataSize: this.currentData ? this.currentData.length : 0
        };
    }

    /**
     * 自动清理过期数据
     */
    autoCleanup() {
        if (!this.options.autoCleanup) {
            return;
        }

        // 清理当前数据（如果过期）
        if (this.isDataExpired()) {
            this.currentData = null;
            this.currentTimestamp = 0;
        }

        // 清理历史记录中的过期数据
        const now = Date.now();
        this.clipboardHistory = this.clipboardHistory.filter(item => {
            return now - item.timestamp <= this.options.expireTime;
        });

        this.logger.debug('Auto cleanup completed', {
            currentDataCleared: !this.currentData,
            historySize: this.clipboardHistory.length
        });
    }

    /**
     * 更新配置
     * @param {Object} newOptions - 新配置
     */
    updateOptions(newOptions) {
        this.options = {
            ...this.options,
            ...newOptions
        };

        this.logger.info('ClipboardManager options updated');
    }
}