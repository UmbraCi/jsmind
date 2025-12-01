/**
 * @license BSD-3-Clause
 * @copyright 2014-2025 hizzgdev@163.com
 *
 * Project Home:
 *   https://github.com/hizzgdev/jsmind/
 */

import { logger } from '../../jsmind.common.js';
import { EnhancedPlugin } from '../../jsmind.enhanced-plugin.js';
import { DataProcessor } from './utils/data-processor.js';
import { NodeConverter } from './utils/node-converter.js';
import { EventManager } from './utils/event-manager.js';
import { ClipboardManager } from './utils/clipboard-manager.js';
import { CopyManager } from './utils/copy-manager.js';
import { PasteManager } from './utils/paste-manager.js';

/**
 * 复制粘贴插件主类
 * 提供完整的节点复制、剪切和粘贴功能
 */
export class CopyPastePlugin extends EnhancedPlugin {
    constructor(jsMind, options = {}) {
        super(jsMind, 'copy-paste', {
            // 基础配置
            enabled: true,

            // 快捷键配置
            shortcuts: {
                copy: 'meta+c',
                paste: 'meta+v',
                cut: 'meta+x'
            },

            // 剪贴板配置
            clipboard: {
                // 是否使用系统剪贴板
                useSystemClipboard: true,
                // 是否保留格式
                preserveFormatting: true,
                // 剪贴板数据过期时间（毫秒）
                expireTime: 300000 // 5分钟
            },

            // 数据处理配置
            dataProcessing: {
                // 是否启用数据验证
                enableValidation: true,
                // 是否启用数据清理
                enableCleanup: true,
                // 最大节点数量
                maxNodes: 1000,
                // 最大嵌套深度
                maxDepth: 50
            },

            // 粘贴配置
            paste: {
                // 粘贴位置策略: 'last_child', 'first_child', 'after', 'before'
                position: 'last_child',
                // 是否保持原始方向
                keepDirection: false,
                // 是否允许粘贴到根节点
                allowRootPaste: false
            },

            // 性能配置
            performance: {
                // 是否启用进度指示器
                showProgress: true,
                // 大数据量阈值
                largeDataThreshold: 100,
                // 是否启用异步处理
                enableAsync: true
            },

            // 事件配置
            events: {
                // 是否启用事件监听
                enableListeners: true,
                // 事件防抖时间
                debounceTime: 100
            },

            ...options
        });

        this.logger = logger;

        // 初始化管理器
        this.dataProcessor = null;
        this.nodeConverter = null;
        this.eventManager = null;
        this.clipboardManager = null;
        this.copyManager = null;
        this.pasteManager = null;

        // 内部状态
        this.isInitialized = false;

        // 绑定方法上下文
        this.handleCopy = this.handleCopy.bind(this);
        this.handlePaste = this.handlePaste.bind(this);
        this.handleCut = this.handleCut.bind(this);
    }

    /**
     * 插件初始化
     */
    onInit() {
        try {
            this.logger.info('Initializing CopyPastePlugin...');

            // 初始化管理器
            this.initializeManagers();

            // 注册快捷键
            this.registerShortcuts();

            // 验证配置
            this.validateConfiguration();

            this.isInitialized = true;

            // 触发初始化完成事件
            if (this.eventManager) {
                this.eventManager.fireEvent('plugin_init', {
                    plugin: 'copy-paste',
                    timestamp: Date.now()
                });
            }

            this.logger.info('CopyPastePlugin initialized successfully');
            return true;
        } catch (error) {
            this.logger.error('CopyPastePlugin initialization failed:', error);
            return false;
        }
    }

    /**
     * 插件启动
     */
    onStart() {
        if (!this.isInitialized) {
            this.logger.warn('CopyPastePlugin not initialized, cannot start');
            return false;
        }

        try {
            this.logger.info('Starting CopyPastePlugin...');

            // 启动事件管理
            if (this.eventManager) {
                this.eventManager.resume();
            }

            this.logger.info('CopyPastePlugin started successfully');
            return true;
        } catch (error) {
            this.logger.error('CopyPastePlugin start failed:', error);
            return false;
        }
    }

    /**
     * 插件停止
     */
    onStop() {
        try {
            this.logger.info('Stopping CopyPastePlugin...');

            // 暂停事件管理
            if (this.eventManager) {
                this.eventManager.pause();
            }

            this.logger.info('CopyPastePlugin stopped successfully');
            return true;
        } catch (error) {
            this.logger.error('CopyPastePlugin stop failed:', error);
            return false;
        }
    }

    /**
     * 插件清理
     */
    onDestroy() {
        try {
            this.logger.info('Destroying CopyPastePlugin...');

            // 注销快捷键
            this.unregisterShortcuts();

            // 清理管理器
            this.cleanupManagers();

            // 清理内部状态
            this.isInitialized = false;

            this.logger.info('CopyPastePlugin destroyed successfully');
        } catch (error) {
            this.logger.error('CopyPastePlugin destroy failed:', error);
        }
    }

    /**
     * 初始化管理器
     */
    initializeManagers() {
        // 初始化数据处理器
        this.dataProcessor = new DataProcessor({
            enableValidation: this.options.dataProcessing.enableValidation,
            enableCleanup: this.options.dataProcessing.enableCleanup,
            formatConfig: {
                maxNodes: this.options.dataProcessing.maxNodes,
                maxDepth: this.options.dataProcessing.maxDepth
            }
        });

        // 初始化节点转换器
        this.nodeConverter = new NodeConverter({
            enableCompatibility: true,
            keepUnknownFields: true
        });

        // 初始化事件管理器
        this.eventManager = new EventManager(this.jsMind, {
            enableListeners: this.options.events.enableListeners,
            debounceTime: this.options.events.debounceTime
        });

        // 初始化剪贴板管理器
        this.clipboardManager = new ClipboardManager({
            useSystemClipboard: this.options.clipboard.useSystemClipboard,
            expireTime: this.options.clipboard.expireTime
        });

        // 初始化复制管理器
        this.copyManager = new CopyManager(this.jsMind, {
            maxNodes: this.options.dataProcessing.maxNodes,
            maxDepth: this.options.dataProcessing.maxDepth
        });

        // 初始化粘贴管理器
        this.pasteManager = new PasteManager(this.jsMind, {
            position: this.options.paste.position,
            keepDirection: this.options.paste.keepDirection,
            allowRootPaste: this.options.paste.allowRootPaste,
            maxNodes: this.options.dataProcessing.maxNodes,
            maxDepth: this.options.dataProcessing.maxDepth
        });

        // 注册自定义数据处理器
        this.dataProcessor.addCustomProcessor(this.customDataProcessor.bind(this));
    }

    /**
     * 注册快捷键
     */
    registerShortcuts() {
        if (!this.jsMind.shortcut) {
            this.logger.warn('Shortcut provider not available');
            return;
        }

        // 注册复制快捷键
        this.jsMind.shortcut.add_shortcut({
            key: this.options.shortcuts.copy,
            handler: this.handleCopy
        });

        // 注册粘贴快捷键
        this.jsMind.shortcut.add_shortcut({
            key: this.options.shortcuts.paste,
            handler: this.handlePaste
        });

        // 注册剪切快捷键
        this.jsMind.shortcut.add_shortcut({
            key: this.options.shortcuts.cut,
            handler: this.handleCut
        });

        this.logger.debug('Shortcuts registered:', this.options.shortcuts);
    }

    /**
     * 注销快捷键
     */
    unregisterShortcuts() {
        if (!this.jsMind.shortcut) {
            return;
        }

        this.jsMind.shortcut.remove_shortcut(this.options.shortcuts.copy);
        this.jsMind.shortcut.remove_shortcut(this.options.shortcuts.paste);
        this.jsMind.shortcut.remove_shortcut(this.options.shortcuts.cut);

        this.logger.debug('Shortcuts unregistered');
    }

    /**
     * 验证配置
     */
    validateConfiguration() {
        // 验证快捷键配置
        if (!this.options.shortcuts ||
            !this.options.shortcuts.copy ||
            !this.options.shortcuts.paste ||
            !this.options.shortcuts.cut) {
            throw new Error('快捷键配置不完整');
        }

        // 验证粘贴位置策略
        const validPositions = ['last_child', 'first_child', 'after', 'before'];
        if (!validPositions.includes(this.options.paste.position)) {
            throw new Error(`无效的粘贴位置策略: ${this.options.paste.position}`);
        }

        // 验证数值配置
        if (this.options.dataProcessing.maxNodes <= 0) {
            throw new Error('maxNodes 必须大于 0');
        }

        if (this.options.dataProcessing.maxDepth <= 0) {
            throw new Error('maxDepth 必须大于 0');
        }

        this.logger.debug('Configuration validated successfully');
    }

    /**
     * 处理复制操作
     * @param {KeyboardEvent} event - 键盘事件
     */
    async handleCopy(event) {
        if (!this.isEnabled()) {
            return;
        }

        try {
            event.preventDefault();

            const selectedNode = this.jsMind.get_selected_node();
            if (!selectedNode) {
                this.showWarning('请先选择要复制的节点');
                return;
            }

            const selectedNodes = [selectedNode]; // 转换为数组格式
            if (!selectedNodes || selectedNodes.length === 0) {
                this.showWarning('请先选择要复制的节点');
                return;
            }

            // 触发复制开始事件
            if (this.eventManager) {
                this.eventManager.fireCopyEvent('start', { nodes: selectedNodes });
            }

            // 复制节点
            const copyResult = this.copyManager.copyNodes(selectedNodes);

            if (copyResult.success) {
                // 写入剪贴板
                await this.clipboardManager.write(copyResult.data.copiedData);

                // 触发复制成功事件
                if (this.eventManager) {
                    this.eventManager.fireCopyEvent('success', copyResult.data);
                }
                this.showSuccess(`已复制 ${selectedNodes.length} 个节点`);
            } else {
                // 触发复制失败事件
                if (this.eventManager) {
                    this.eventManager.fireCopyEvent('error', { error: copyResult.error });
                }
                this.showError('复制失败: ' + copyResult.error);
            }
        } catch (error) {
            this.logger.error('Copy operation failed:', error);
            this.showError('复制操作失败');
        }
    }

    /**
     * 处理粘贴操作
     * @param {KeyboardEvent} event - 键盘事件
     */
    async handlePaste(event) {
        if (!this.isEnabled()) {
            return;
        }

        try {
            event.preventDefault();

            // 从剪贴板读取数据
            const clipboardData = await this.clipboardManager.read();
            if (!clipboardData) {
                this.showWarning('剪贴板为空，请先复制或剪切节点');
                return;
            }

            // 解析剪贴板数据
            const parsedData = this.clipboardManager.parseData(clipboardData);

            // 获取目标节点
            const targetNode = this.jsMind.get_selected_node();
            if (!targetNode) {
                this.showWarning('请选择目标节点');
                return;
            }

            // 触发粘贴开始事件
            if (this.eventManager) {
                this.eventManager.firePasteEvent('start', {
                    targetNode: targetNode.id,
                    clipboardData: parsedData
                });
            }

            // 粘贴节点
            const pasteResult = this.pasteManager.pasteNodes(targetNode, parsedData);

            if (pasteResult.success) {
                // 触发粘贴成功事件
                if (this.eventManager) {
                    this.eventManager.firePasteEvent('success', pasteResult.data);
                }
                this.showSuccess('粘贴成功');
            } else {
                // 触发粘贴失败事件
                if (this.eventManager) {
                    this.eventManager.firePasteEvent('error', { error: pasteResult.error });
                }
                this.showError('粘贴失败: ' + pasteResult.error);
            }
        } catch (error) {
            this.logger.error('Paste operation failed:', error);
            this.showError('粘贴操作失败');
        }
    }

    /**
     * 处理剪切操作
     * @param {KeyboardEvent} event - 键盘事件
     */
    async handleCut(event) {
        if (!this.isEnabled()) {
            return;
        }

        try {
            event.preventDefault();

            const selectedNode = this.jsMind.get_selected_node();
            if (!selectedNode) {
                this.showWarning('请先选择要复制的节点');
                return;
            }

            const selectedNodes = [selectedNode]; // 转换为数组格式
            if (!selectedNodes || selectedNodes.length === 0) {
                this.showWarning('请先选择要剪切的节点');
                return;
            }

            // 检查是否包含根节点
            const hasRootNode = selectedNodes.some(node => node.isroot);
            if (hasRootNode) {
                this.showWarning('不能剪切根节点');
                return;
            }

            // 触发剪切开始事件
            if (this.eventManager) {
                this.eventManager.fireCutEvent('start', { nodes: selectedNodes });
            }

            // 先复制节点
            const copyResult = this.copyManager.copyNodes(selectedNodes);
            if (!copyResult.success) {
                this.showError('剪切失败: ' + copyResult.error);
                return;
            }

            // 写入剪贴板
            await this.clipboardManager.write(copyResult.data.copiedData);

            // 删除原节点
            const removedNodes = [];
            for (const node of selectedNodes) {
                if (this.jsMind.remove_node(node)) {
                    removedNodes.push(node);
                }
            }

            if (removedNodes.length > 0) {
                // 触发剪切成功事件
                if (this.eventManager) {
                    this.eventManager.fireCutEvent('success', {
                        removedNodes: removedNodes,
                        nodeCount: removedNodes.length
                    });
                }
                this.showSuccess(`已剪切 ${removedNodes.length} 个节点`);
            } else {
                // 触发剪切失败事件
                if (this.eventManager) {
                    this.eventManager.fireCutEvent('error', { error: '未能删除任何节点' });
                }
                this.showError('剪切失败');
            }
        } catch (error) {
            this.logger.error('Cut operation failed:', error);
            this.showError('剪切操作失败');
        }
    }

    /**
     * 自定义数据处理器
     * @param {Object} data - 数据
     * @returns {Object} 处理后的数据
     */
    customDataProcessor(data) {
        // 可以在这里添加自定义的数据处理逻辑
        return data;
    }

    /**
     * 显示成功消息
     * @param {string} message - 消息内容
     */
    showSuccess(message) {
        this.logger.info(message);
        // 这里可以集成UI通知系统
    }

    /**
     * 显示警告消息
     * @param {string} message - 消息内容
     */
    showWarning(message) {
        this.logger.warn(message);
        // 这里可以集成UI通知系统
    }

    /**
     * 显示错误消息
     * @param {string} message - 消息内容
     */
    showError(message) {
        this.logger.error(message);
        // 这里可以集成UI通知系统
    }

    /**
     * 检查插件是否启用
     * @returns {boolean} 是否启用
     */
    isEnabled() {
        return this.options.enabled && this.isInitialized;
    }

    /**
     * 清理管理器
     */
    cleanupManagers() {
        if (this.eventManager) {
            this.eventManager.cleanup();
            this.eventManager = null;
        }

        if (this.clipboardManager) {
            this.clipboardManager.clear();
            this.clipboardManager = null;
        }

        if (this.copyManager) {
            this.copyManager.clearCopyHistory();
            this.copyManager = null;
        }

        if (this.pasteManager) {
            this.pasteManager.clearPasteHistory();
            this.pasteManager = null;
        }

        this.dataProcessor = null;
        this.nodeConverter = null;
    }

    /**
     * 更新插件配置
     * @param {Object} newOptions - 新的配置选项
     */
    updateOptions(newOptions) {
        // 合并配置
        this.options = {
            ...this.options,
            ...newOptions
        };

        // 更新管理器配置
        if (this.clipboardManager) {
            this.clipboardManager.updateOptions({
                useSystemClipboard: this.options.clipboard.useSystemClipboard,
                expireTime: this.options.clipboard.expireTime
            });
        }

        if (this.copyManager) {
            this.copyManager.updateOptions({
                maxNodes: this.options.dataProcessing.maxNodes,
                maxDepth: this.options.dataProcessing.maxDepth
            });
        }

        if (this.pasteManager) {
            this.pasteManager.updateOptions({
                position: this.options.paste.position,
                keepDirection: this.options.paste.keepDirection,
                allowRootPaste: this.options.paste.allowRootPaste,
                maxNodes: this.options.dataProcessing.maxNodes,
                maxDepth: this.options.dataProcessing.maxDepth
            });
        }

        // 重新验证配置
        this.validateConfiguration();

        this.logger.info('Plugin options updated');
    }

    /**
     * 获取插件信息
     * @returns {Object} 插件信息
     */
    getInfo() {
        return {
            name: 'copy-paste',
            version: '1.0.0',
            description: 'jsMind 复制粘贴插件',
            enabled: this.isEnabled(),
            managers: {
                dataProcessor: !!this.dataProcessor,
                nodeConverter: !!this.nodeConverter,
                eventManager: !!this.eventManager,
                clipboardManager: !!this.clipboardManager,
                copyManager: !!this.copyManager,
                pasteManager: !!this.pasteManager
            }
        };
    }
}

// 添加静态 instanceName 属性
CopyPastePlugin.instanceName = 'copy-paste';

// 导出插件
export default CopyPastePlugin;