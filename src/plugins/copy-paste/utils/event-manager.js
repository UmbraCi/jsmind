/**
 * @license BSD-3-Clause
 * @copyright 2014-2025 hizzgdev@163.com
 *
 * Project Home:
 *   https://github.com/hizzgdev/jsmind/
 */

import { logger, EventType } from '../../../jsmind.common.js';

/**
 * 事件管理器类
 * 负责管理插件相关的事件处理和状态通知
 */
export class EventManager {
    constructor(jsMindInstance, options = {}) {
        this.jsMind = jsMindInstance;
        this.options = {
            // 是否启用事件监听
            enableListeners: true,
            // 事件防抖时间（毫秒）
            debounceTime: 100,
            // 最大事件监听器数量
            maxListeners: 50,
            // 是否启用事件队列
            enableEventQueue: true,
            // 事件队列最大长度
            maxEventQueueSize: 100,
            ...options
        };

        this.logger = logger;
        this.listeners = new Map();
        this.eventQueue = [];
        this.isProcessingQueue = false;
        this.lastEventTime = 0;
        this.eventStats = {
            total: 0,
            successful: 0,
            failed: 0,
            byType: new Map()
        };

        this.initializeEventHandlers();
    }

    /**
     * 初始化事件处理器
     */
    initializeEventHandlers() {
        if (!this.options.enableListeners) {
            return;
        }

        // 绑定jsMind事件监听器
        this.bindJsmindEvents();

        // 初始化自定义事件
        this.initializeCustomEvents();

        this.logger.info('EventManager initialized');
    }

    /**
     * 绑定jsMind事件
     */
    bindJsmindEvents() {
        // 监听节点选择事件
        this.addEventListener('select', (event) => {
            this.handleNodeSelect(event);
        });

        // 监听节点编辑事件
        this.addEventListener('edit', (event) => {
            this.handleNodeEdit(event);
        });

        // 监听历史变化事件
        this.addEventListener('history_change', (event) => {
            this.handleHistoryChange(event);
        });

        // 监听视图变化事件
        this.addEventListener('resize', (event) => {
            this.handleViewResize(event);
        });
    }

    /**
     * 初始化自定义事件
     */
    initializeCustomEvents() {
        // 复制粘贴相关的事件类型
        this.customEventTypes = {
            COPY_START: 'copy_start',
            COPY_SUCCESS: 'copy_success',
            COPY_ERROR: 'copy_error',
            PASTE_START: 'paste_start',
            PASTE_SUCCESS: 'paste_success',
            PASTE_ERROR: 'paste_error',
            CUT_START: 'cut_start',
            CUT_SUCCESS: 'cut_success',
            CUT_ERROR: 'cut_error',
            CLIPBOARD_CHANGE: 'clipboard_change',
            NODE_CONVERT: 'node_convert',
            DATA_PROCESS: 'data_process'
        };

        // 注册自定义事件处理器
        for (const eventType of Object.values(this.customEventTypes)) {
            this.listeners.set(eventType, []);
        }
    }

    /**
     * 添加事件监听器
     * @param {string} eventType - 事件类型
     * @param {Function} handler - 事件处理函数
     * @param {Object} options - 选项
     */
    addEventListener(eventType, handler, options = {}) {
        if (typeof handler !== 'function') {
            throw new Error('事件处理器必须是函数');
        }

        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }

        const listeners = this.listeners.get(eventType);

        // 检查监听器数量限制
        if (listeners.length >= this.options.maxListeners) {
            this.logger.warn(`事件类型 ${eventType} 的监听器数量已达到限制`);
            return false;
        }

        const listener = {
            handler,
            once: options.once || false,
            priority: options.priority || 0,
            id: this.generateListenerId()
        };

        // 按优先级插入
        const insertIndex = listeners.findIndex(l => l.priority < listener.priority);
        if (insertIndex === -1) {
            listeners.push(listener);
        } else {
            listeners.splice(insertIndex, 0, listener);
        }

        this.logger.debug(`添加事件监听器: ${eventType}, ID: ${listener.id}`);
        return listener.id;
    }

    /**
     * 移除事件监听器
     * @param {string} eventType - 事件类型
     * @param {Function|string} handlerOrId - 处理函数或监听器ID
     */
    removeEventListener(eventType, handlerOrId) {
        const listeners = this.listeners.get(eventType);
        if (!listeners) {
            return false;
        }

        const index = listeners.findIndex(l =>
            l.handler === handlerOrId || l.id === handlerOrId
        );

        if (index !== -1) {
            const removed = listeners.splice(index, 1)[0];
            this.logger.debug(`移除事件监听器: ${eventType}, ID: ${removed.id}`);
            return true;
        }

        return false;
    }

    /**
     * 触发事件
     * @param {string} eventType - 事件类型
     * @param {*} eventData - 事件数据
     * @param {Object} options - 选项
     */
    fireEvent(eventType, eventData = null, options = {}) {
        try {
            // 更新统计信息
            this.updateEventStats(eventType);

            // 防抖处理
            if (options.debounce && this.shouldDebounce(eventType)) {
                this.queueEvent(eventType, eventData, options);
                return;
            }

            // 立即执行事件
            this.executeEvent(eventType, eventData, options);

            this.logger.debug(`事件触发: ${eventType}`);
        } catch (error) {
            this.logger.error(`事件触发失败: ${eventType}`, error);
            this.eventStats.failed++;
        }
    }

    /**
     * 执行事件
     * @param {string} eventType - 事件类型
     * @param {*} eventData - 事件数据
     * @param {Object} options - 选项
     */
    executeEvent(eventType, eventData, options = {}) {
        const listeners = this.listeners.get(eventType);
        if (!listeners || listeners.length === 0) {
            return;
        }

        const event = {
            type: eventType,
            data: eventData,
            timestamp: Date.now(),
            source: options.source || 'plugin',
            preventDefault: false,
            stopPropagation: false
        };

        // 执行监听器
        const toRemove = [];
        for (let i = 0; i < listeners.length; i++) {
            const listener = listeners[i];

            try {
                listener.handler(event);

                if (listener.once) {
                    toRemove.push(i);
                }

                if (event.stopPropagation) {
                    break;
                }
            } catch (error) {
                this.logger.error(`事件处理器执行失败: ${eventType}`, error);
                this.eventStats.failed++;
            }
        }

        // 移除一次性监听器
        toRemove.reverse().forEach(index => {
            listeners.splice(index, 1);
        });

        this.eventStats.successful++;
    }

    /**
     * 队列事件
     * @param {string} eventType - 事件类型
     * @param {*} eventData - 事件数据
     * @param {Object} options - 选项
     */
    queueEvent(eventType, eventData, options = {}) {
        if (!this.options.enableEventQueue) {
            return;
        }

        if (this.eventQueue.length >= this.options.maxEventQueueSize) {
            this.eventQueue.shift(); // 移除最旧的事件
        }

        this.eventQueue.push({
            eventType,
            eventData,
            options,
            timestamp: Date.now()
        });

        this.processEventQueue();
    }

    /**
     * 处理事件队列
     */
    processEventQueue() {
        if (this.isProcessingQueue || this.eventQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        setTimeout(() => {
            while (this.eventQueue.length > 0) {
                const queuedEvent = this.eventQueue.shift();
                this.executeEvent(queuedEvent.eventType, queuedEvent.eventData, queuedEvent.options);
            }
            this.isProcessingQueue = false;
        }, this.options.debounceTime);
    }

    /**
     * 检查是否应该防抖
     * @param {string} eventType - 事件类型
     * @returns {boolean} 是否应该防抖
     */
    shouldDebounce(eventType) {
        const now = Date.now();
        const timeDiff = now - this.lastEventTime;
        this.lastEventTime = now;
        return timeDiff < this.options.debounceTime;
    }

    /**
     * 更新事件统计信息
     * @param {string} eventType - 事件类型
     */
    updateEventStats(eventType) {
        this.eventStats.total++;
        const count = this.eventStats.byType.get(eventType) || 0;
        this.eventStats.byType.set(eventType, count + 1);
    }

    /**
     * 处理节点选择事件
     * @param {Object} event - 事件对象
     */
    handleNodeSelect(event) {
        this.fireEvent(this.customEventTypes.NODE_SELECT, {
            nodeId: event.nodeId,
            selectedNodes: this.jsMind.get_selected_node() ? [this.jsMind.get_selected_node()] : []
        }, { source: 'jsmind' });
    }

    /**
     * 处理节点编辑事件
     * @param {Object} event - 事件对象
     */
    handleNodeEdit(event) {
        this.fireEvent(this.customEventTypes.NODE_EDIT, {
            nodeId: event.nodeId,
            oldValue: event.oldValue,
            newValue: event.newValue
        }, { source: 'jsmind' });
    }

    /**
     * 处理历史变化事件
     * @param {Object} event - 事件对象
     */
    handleHistoryChange(event) {
        this.fireEvent(this.customEventTypes.HISTORY_CHANGE, {
            action: event.action,
            data: event.data
        }, { source: 'jsmind' });
    }

    /**
     * 处理视图变化事件
     * @param {Object} event - 事件对象
     */
    handleViewResize(event) {
        this.fireEvent(this.customEventTypes.VIEW_RESIZE, {
            width: event.width,
            height: event.height
        }, { source: 'jsmind' });
    }

    /**
     * 触发复制相关事件
     * @param {string} eventType - 事件类型
     * @param {Object} data - 事件数据
     */
    fireCopyEvent(eventType, data) {
        switch (eventType) {
            case 'start':
                this.fireEvent(this.customEventTypes.COPY_START, data);
                break;
            case 'success':
                this.fireEvent(this.customEventTypes.COPY_SUCCESS, data);
                break;
            case 'error':
                this.fireEvent(this.customEventTypes.COPY_ERROR, data);
                break;
        }
    }

    /**
     * 触发粘贴相关事件
     * @param {string} eventType - 事件类型
     * @param {Object} data - 事件数据
     */
    firePasteEvent(eventType, data) {
        switch (eventType) {
            case 'start':
                this.fireEvent(this.customEventTypes.PASTE_START, data);
                break;
            case 'success':
                this.fireEvent(this.customEventTypes.PASTE_SUCCESS, data);
                break;
            case 'error':
                this.fireEvent(this.customEventTypes.PASTE_ERROR, data);
                break;
        }
    }

    /**
     * 触发剪切相关事件
     * @param {string} eventType - 事件类型
     * @param {Object} data - 事件数据
     */
    fireCutEvent(eventType, data) {
        switch (eventType) {
            case 'start':
                this.fireEvent(this.customEventTypes.CUT_START, data);
                break;
            case 'success':
                this.fireEvent(this.customEventTypes.CUT_SUCCESS, data);
                break;
            case 'error':
                this.fireEvent(this.customEventTypes.CUT_ERROR, data);
                break;
        }
    }

    /**
     * 触发剪贴板变化事件
     * @param {Object} data - 事件数据
     */
    fireClipboardChangeEvent(data) {
        this.fireEvent(this.customEventTypes.CLIPBOARD_CHANGE, data);
    }

    /**
     * 触发节点转换事件
     * @param {Object} data - 事件数据
     */
    fireNodeConvertEvent(data) {
        this.fireEvent(this.customEventTypes.NODE_CONVERT, data);
    }

    /**
     * 触发数据处理事件
     * @param {Object} data - 事件数据
     */
    fireDataProcessEvent(data) {
        this.fireEvent(this.customEventTypes.DATA_PROCESS, data);
    }

    /**
     * 同步状态到jsMind
     * @param {string} eventType - 事件类型
     * @param {Object} state - 状态数据
     */
    syncStateToJsmind(eventType, state) {
        if (this.jsMind && typeof this.jsMind.fire_event === 'function') {
            try {
                this.jsMind.fire_event(eventType, state);
            } catch (error) {
                this.logger.error('状态同步到jsMind失败:', error);
            }
        }
    }

    /**
     * 从jsMind同步状态
     * @param {string} eventType - 事件类型
     * @returns {Object} 状态数据
     */
    syncStateFromJsmind(eventType) {
        if (this.jsMind) {
            switch (eventType) {
                case 'selected_nodes':
                    return this.jsMind.get_selected_node() ? [this.jsMind.get_selected_node()] : [];
                case 'current_node':
                    return this.jsMind.get_selected_node();
                case 'mind_data':
                    return this.jsMind.get_data();
                default:
                    return null;
            }
        }
        return null;
    }

    /**
     * 生成监听器ID
     * @returns {string} 唯一ID
     */
    generateListenerId() {
        return 'listener_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 获取事件统计信息
     * @returns {Object} 统计信息
     */
    getEventStats() {
        return {
            ...this.eventStats,
            byType: Object.fromEntries(this.eventStats.byType),
            queueSize: this.eventQueue.length,
            listenersCount: Array.from(this.listeners.values())
                .reduce((total, listeners) => total + listeners.length, 0)
        };
    }

    /**
     * 清理事件监听器
     */
    cleanup() {
        // 清空所有监听器
        this.listeners.clear();

        // 清空事件队列
        this.eventQueue = [];

        // 重置统计信息
        this.eventStats = {
            total: 0,
            successful: 0,
            failed: 0,
            byType: new Map()
        };

        this.logger.info('EventManager cleaned up');
    }

    /**
     * 暂停事件处理
     */
    pause() {
        this.options.enableListeners = false;
        this.logger.info('EventManager paused');
    }

    /**
     * 恢复事件处理
     */
    resume() {
        this.options.enableListeners = true;
        this.logger.info('EventManager resumed');
    }

    /**
     * 检查是否启用
     * @returns {boolean} 是否启用
     */
    isEnabled() {
        return this.options.enableListeners;
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

        this.logger.info('EventManager options updated');
    }
}