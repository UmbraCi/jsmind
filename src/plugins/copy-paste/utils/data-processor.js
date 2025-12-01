/**
 * @license BSD-3-Clause
 * @copyright 2014-2025 hizzgdev@163.com
 *
 * Project Home:
 *   https://github.com/hizzgdev/jsmind/
 */

import { logger } from '../../../jsmind.common.js';
import { util } from '../../../jsmind.util.js';

/**
 * 数据处理器类
 * 负责节点数据的格式转换、验证和清理
 */
export class DataProcessor {
    constructor(options = {}) {
        this.options = {
            // 是否启用数据验证
            enableValidation: true,
            // 是否启用数据清理
            enableCleanup: true,
            // 自定义数据处理函数
            customProcessors: [],
            // 数据格式配置
            formatConfig: {
                // 允许的字段
                allowedFields: ['id', 'topic', 'data', 'direction', 'expanded', 'children', 'parent', 'style'],
                // 必需的字段
                requiredFields: ['topic'],
                // 最大嵌套深度
                maxDepth: 100,
                // 最大节点数量
                maxNodes: 10000
            },
            ...options
        };

        this.logger = logger;
    }

    /**
     * 处理节点数据
     * @param {Object|Array} data - 原始数据
     * @param {string} targetFormat - 目标格式
     * @returns {Object} 处理后的数据
     */
    processData(data, targetFormat = 'jsmind') {
        try {
            // 数据预处理
            let processedData = this.preprocessData(data);

            // 格式转换
            processedData = this.convertFormat(processedData, targetFormat);

            // 数据验证
            if (this.options.enableValidation) {
                this.validateData(processedData);
            }

            // 数据清理
            if (this.options.enableCleanup) {
                processedData = this.cleanupData(processedData);
            }

            // 自定义处理器
            processedData = this.applyCustomProcessors(processedData);

            return processedData;
        } catch (error) {
            this.logger.error('Data processing failed:', error);
            throw new Error(`数据处理失败: ${error.message}`);
        }
    }

    /**
     * 数据预处理
     * @param {Object|Array} data - 原始数据
     * @returns {Object} 预处理后的数据
     */
    preprocessData(data) {
        if (!data) {
            throw new Error('数据不能为空');
        }

        // 如果是数组，转换为对象格式
        if (Array.isArray(data)) {
            return this.arrayToTree(data);
        }

        // 如果是单个节点，包装为数组
        if (!data.children && !data.nodes) {
            return {
                id: data.id || this.generateNodeId(),
                topic: data.topic || '',
                data: data.data || {},
                children: []
            };
        }

        return data;
    }

    /**
     * 数组转树结构
     * @param {Array} nodeList - 节点列表
     * @returns {Object} 树结构数据
     */
    arrayToTree(nodeList) {
        if (!Array.isArray(nodeList) || nodeList.length === 0) {
            throw new Error('节点列表格式不正确');
        }

        const nodeMap = new Map();
        const rootNodes = [];

        // 创建节点映射
        nodeList.forEach(node => {
            const processedNode = {
                id: node.id || this.generateNodeId(),
                topic: node.topic || '',
                data: node.data || {},
                children: [],
                ...node
            };
            nodeMap.set(processedNode.id, processedNode);
        });

        // 构建树结构
        nodeList.forEach(node => {
            const currentNode = nodeMap.get(node.id || node.id);
            const parentId = node.parent || node.parentId;

            if (parentId && nodeMap.has(parentId)) {
                nodeMap.get(parentId).children.push(currentNode);
            } else {
                rootNodes.push(currentNode);
            }
        });

        // 返回第一个根节点或虚拟根节点
        if (rootNodes.length === 1) {
            return rootNodes[0];
        } else if (rootNodes.length > 1) {
            return {
                id: this.generateNodeId(),
                topic: '根节点',
                data: {},
                children: rootNodes
            };
        } else {
            throw new Error('无法构建有效的树结构');
        }
    }

    /**
     * 格式转换
     * @param {Object} data - 源数据
     * @param {string} targetFormat - 目标格式
     * @returns {Object} 转换后的数据
     */
    convertFormat(data, targetFormat) {
        switch (targetFormat) {
            case 'jsmind':
                return this.toJsmindFormat(data);
            case 'node_array':
                return this.toNodeArrayFormat(data);
            case 'node_tree':
                return this.toNodeTreeFormat(data);
            case 'freemind':
                return this.toFreemindFormat(data);
            default:
                return data;
        }
    }

    /**
     * 转换为jsmind格式
     * @param {Object} data - 源数据
     * @returns {Object} jsmind格式数据
     */
    toJsmindFormat(data) {
        const convertNode = (node) => {
            const jsmindNode = {
                id: node.id || this.generateNodeId(),
                topic: node.topic || '',
                data: node.data || {}
            };

            if (node.direction) {
                jsmindNode.direction = node.direction;
            }
            if (typeof node.expanded === 'boolean') {
                jsmindNode.expanded = node.expanded;
            }
            if (node.children && node.children.length > 0) {
                jsmindNode.children = node.children.map(convertNode);
            }

            return jsmindNode;
        };

        return convertNode(data);
    }

    /**
     * 转换为节点数组格式
     * @param {Object} data - 源数据
     * @returns {Array} 节点数组
     */
    toNodeArrayFormat(data) {
        const result = [];

        const traverse = (node, parentId = null) => {
            const arrayNode = {
                id: node.id || this.generateNodeId(),
                topic: node.topic || '',
                data: node.data || {}
            };

            if (parentId) {
                arrayNode.parentid = parentId;
            }

            result.push(arrayNode);

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => {
                    traverse(child, arrayNode.id);
                });
            }
        };

        traverse(data);
        return result;
    }

    /**
     * 转换为节点树格式
     * @param {Object} data - 源数据
     * @returns {Object} 节点树格式
     */
    toNodeTreeFormat(data) {
        return this.toJsmindFormat(data);
    }

    /**
     * 转换为FreeMind格式
     * @param {Object} data - 源数据
     * @returns {Object} FreeMind格式数据
     */
    toFreemindFormat(data) {
        const convertNode = (node) => {
            const freemindNode = {
                TEXT: node.topic || '',
                ID: node.id || this.generateNodeId()
            };

            if (node.data && Object.keys(node.data).length > 0) {
                freemindNode.ATTRIBUTE = Object.entries(node.data).map(([key, value]) => ({
                    NAME: key,
                    VALUE: String(value)
                }));
            }

            if (node.children && node.children.length > 0) {
                freemindNode.NODE = node.children.map(convertNode);
            }

            return freemindNode;
        };

        return {
            map: {
                node: convertNode(data)
            }
        };
    }

    /**
     * 数据验证
     * @param {Object} data - 待验证的数据
     */
    validateData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('数据格式不正确');
        }

        let nodeCount = 0;
        let maxDepth = 0;

        const validateNode = (node, depth = 0) => {
            nodeCount++;
            maxDepth = Math.max(maxDepth, depth);

            // 检查节点数量限制
            if (nodeCount > this.options.formatConfig.maxNodes) {
                throw new Error(`节点数量超过限制 (${this.options.formatConfig.maxNodes})`);
            }

            // 检查嵌套深度限制
            if (depth > this.options.formatConfig.maxDepth) {
                throw new Error(`嵌套深度超过限制 (${this.options.formatConfig.maxDepth})`);
            }

            // 检查必需字段
            for (const field of this.options.formatConfig.requiredFields) {
                if (!node[field]) {
                    throw new Error(`缺少必需字段: ${field}`);
                }
            }

            // 验证字段名
            for (const field in node) {
                if (!this.options.formatConfig.allowedFields.includes(field)) {
                    this.logger.warn('未知字段:', field);
                }
            }

            // 验证子节点
            if (node.children && Array.isArray(node.children)) {
                node.children.forEach(child => validateNode(child, depth + 1));
            }
        };

        validateNode(data);

        this.logger.info(`数据验证通过: ${nodeCount}个节点, 最大深度${maxDepth}`);
    }

    /**
     * 数据清理
     * @param {Object} data - 待清理的数据
     * @returns {Object} 清理后的数据
     */
    cleanupData(data) {
        const cleanupNode = (node) => {
            const cleanNode = {};

            // 只保留允许的字段
            this.options.formatConfig.allowedFields.forEach(field => {
                if (node[field] !== undefined && node[field] !== null) {
                    cleanNode[field] = node[field];
                }
            });

            // 清理topic字段
            if (cleanNode.topic) {
                cleanNode.topic = String(cleanNode.topic).trim();
                if (cleanNode.topic.length === 0) {
                    cleanNode.topic = '未命名节点';
                }
            }

            // 清理data字段
            if (cleanNode.data && typeof cleanNode.data === 'object') {
                const cleanData = {};
                for (const [key, value] of Object.entries(cleanNode.data)) {
                    if (value !== null && value !== undefined) {
                        cleanData[key] = value;
                    }
                }
                cleanNode.data = cleanData;
            }

            // 递归清理子节点
            if (cleanNode.children && Array.isArray(cleanNode.children)) {
                cleanNode.children = cleanNode.children
                    .map(cleanupNode)
                    .filter(child => child); // 过滤掉空节点
            }

            return cleanNode;
        };

        return cleanupNode(data);
    }

    /**
     * 应用自定义处理器
     * @param {Object} data - 待处理的数据
     * @returns {Object} 处理后的数据
     */
    applyCustomProcessors(data) {
        let processedData = data;

        this.options.customProcessors.forEach(processor => {
            if (typeof processor === 'function') {
                try {
                    processedData = processor(processedData);
                } catch (error) {
                    this.logger.warn('自定义处理器执行失败:', error);
                }
            }
        });

        return processedData;
    }

    /**
     * 添加自定义处理器
     * @param {Function} processor - 处理器函数
     */
    addCustomProcessor(processor) {
        if (typeof processor === 'function') {
            this.options.customProcessors.push(processor);
        }
    }

    /**
     * 移除自定义处理器
     * @param {Function} processor - 处理器函数
     */
    removeCustomProcessor(processor) {
        const index = this.options.customProcessors.indexOf(processor);
        if (index > -1) {
            this.options.customProcessors.splice(index, 1);
        }
    }

    /**
     * 生成节点ID
     * @returns {string} 新的节点ID
     */
    generateNodeId() {
        return util.uuid.newid();
    }

    /**
     * 获取支持的数据格式
     * @returns {Array<string>} 支持的格式列表
     */
    getSupportedFormats() {
        return ['jsmind', 'node_array', 'node_tree', 'freemind'];
    }

    /**
     * 更新配置
     * @param {Object} newOptions - 新的配置选项
     */
    updateOptions(newOptions) {
        this.options = {
            ...this.options,
            ...newOptions,
            formatConfig: {
                ...this.options.formatConfig,
                ...(newOptions.formatConfig || {})
            }
        };
    }
}