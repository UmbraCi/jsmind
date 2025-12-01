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
 * 节点转换器类
 * 负责在不同节点数据格式之间进行转换
 */
export class NodeConverter {
    constructor(options = {}) {
        this.options = {
            // 是否启用兼容性处理
            enableCompatibility: true,
            // 默认转换配置
            defaultFormat: 'jsmind',
            // 字段映射配置
            fieldMappings: {
                // 通用字段映射
                id: ['id', 'nodeId', 'key', 'uid'],
                topic: ['topic', 'text', 'title', 'name', 'label'],
                data: ['data', 'metadata', 'attributes', 'props'],
                direction: ['direction', 'orientation', 'side'],
                expanded: ['expanded', 'folded', 'collapsed'],
                children: ['children', 'nodes', 'subnodes', 'childs']
            },
            // 兼容性配置
            compatibility: {
                // 是否保留未知字段
                keepUnknownFields: true,
                // 是否进行类型转换
                enableTypeConversion: true,
                // 是否处理缺失字段
                handleMissingFields: true
            },
            ...options
        };

        this.logger = logger;
        this.formatHandlers = this.initializeFormatHandlers();
    }

    /**
     * 初始化格式处理器
     * @returns {Map} 格式处理器映射
     */
    initializeFormatHandlers() {
        return new Map([
            ['jsmind', this.handleJsmindFormat.bind(this)],
            ['node_tree', this.handleNodeTreeFormat.bind(this)],
            ['node_array', this.handleNodeArrayFormat.bind(this)],
            ['freemind', this.handleFreemindFormat.bind(this)],
            ['xmind', this.handleXmindFormat.bind(this)],
            ['mindmanager', this.handleMindmanagerFormat.bind(this)]
        ]);
    }

    /**
     * 转换节点数据格式
     * @param {Object|Array} sourceData - 源数据
     * @param {string} sourceFormat - 源格式
     * @param {string} targetFormat - 目标格式
     * @returns {Object|Array} 转换后的数据
     */
    convert(sourceData, sourceFormat, targetFormat) {
        try {
            // 如果源格式和目标格式相同，直接返回
            if (sourceFormat === targetFormat) {
                return sourceData;
            }

            // 标准化为中间格式
            const standardized = this.standardize(sourceData, sourceFormat);

            // 转换为目标格式
            const result = this.destandardize(standardized, targetFormat);

            this.logger.info(`格式转换成功: ${sourceFormat} -> ${targetFormat}`);
            return result;
        } catch (error) {
            this.logger.error(`格式转换失败: ${sourceFormat} -> ${targetFormat}`, error);
            throw new Error(`格式转换失败: ${error.message}`);
        }
    }

    /**
     * 标准化数据为通用格式
     * @param {Object|Array} data - 源数据
     * @param {string} format - 数据格式
     * @returns {Object} 标准化后的数据
     */
    standardize(data, format) {
        const handler = this.formatHandlers.get(format);
        if (!handler) {
            throw new Error(`不支持的数据格式: ${format}`);
        }

        return handler(data);
    }

    /**
     * 反标准化为目标格式
     * @param {Object} standardizedData - 标准化数据
     * @param {string} targetFormat - 目标格式
     * @returns {Object|Array} 目标格式数据
     */
    destandardize(standardizedData, targetFormat) {
        switch (targetFormat) {
            case 'jsmind':
                return this.toJsmindFormat(standardizedData);
            case 'node_tree':
                return this.toNodeTreeFormat(standardizedData);
            case 'node_array':
                return this.toNodeArrayFormat(standardizedData);
            case 'freemind':
                return this.toFreemindFormat(standardizedData);
            default:
                throw new Error(`不支持的目标格式: ${targetFormat}`);
        }
    }

    /**
     * 处理jsmind格式
     * @param {Object} data - jsmind格式数据
     * @returns {Object} 标准化数据
     */
    handleJsmindFormat(data) {
        const standardizeNode = (node) => ({
            id: node.id || this.generateId(),
            topic: node.topic || '',
            data: node.data || {},
            direction: node.direction,
            expanded: node.expanded,
            children: node.children ? node.children.map(standardizeNode) : []
        });

        return Array.isArray(data) ? data.map(standardizeNode) : standardizeNode(data);
    }

    /**
     * 处理节点树格式
     * @param {Object} data - 节点树格式数据
     * @returns {Object} 标准化数据
     */
    handleNodeTreeFormat(data) {
        return this.handleJsmindFormat(data);
    }

    /**
     * 处理节点数组格式
     * @param {Array} data - 节点数组格式数据
     * @returns {Object} 标准化数据
     */
    handleNodeArrayFormat(data) {
        if (!Array.isArray(data)) {
            throw new Error('节点数组格式必须是数组');
        }

        const nodeMap = new Map();
        const rootNodes = [];

        // 创建节点映射
        data.forEach(node => {
            const standardNode = {
                id: node.id || this.generateId(),
                topic: node.topic || node.text || '',
                data: node.data || {},
                direction: node.direction,
                expanded: node.expanded,
                children: []
            };

            nodeMap.set(standardNode.id, standardNode);
        });

        // 构建树结构
        data.forEach(node => {
            const nodeId = node.id;
            const parentNodeId = node.parentid || node.parent;

            if (parentNodeId && nodeMap.has(parentNodeId)) {
                nodeMap.get(parentNodeId).children.push(nodeMap.get(nodeId));
            } else {
                rootNodes.push(nodeMap.get(nodeId));
            }
        });

        // 返回根节点或虚拟根节点
        if (rootNodes.length === 1) {
            return rootNodes[0];
        } else {
            return {
                id: this.generateId(),
                topic: '根节点',
                data: {},
                children: rootNodes
            };
        }
    }

    /**
     * 处理FreeMind格式
     * @param {Object} data - FreeMind格式数据
     * @returns {Object} 标准化数据
     */
    handleFreemindFormat(data) {
        const convertNode = (node) => {
            const standardNode = {
                id: node.ID || this.generateId(),
                topic: node.TEXT || '',
                data: {},
                children: []
            };

            // 处理属性
            if (node.ATTRIBUTE) {
                if (Array.isArray(node.ATTRIBUTE)) {
                    node.ATTRIBUTE.forEach(attr => {
                        standardNode.data[attr.NAME] = attr.VALUE;
                    });
                } else {
                    standardNode.data[node.ATTRIBUTE.NAME] = node.ATTRIBUTE.VALUE;
                }
            }

            // 处理子节点
            if (node.NODE) {
                const children = Array.isArray(node.NODE) ? node.NODE : [node.NODE];
                standardNode.children = children.map(convertNode);
            }

            return standardNode;
        };

        const mapNode = data.map || data;
        const rootNode = mapNode.node || mapNode.NODE;

        if (!rootNode) {
            throw new Error('无效的FreeMind格式数据');
        }

        return convertNode(rootNode);
    }

    /**
     * 处理XMind格式
     * @param {Object} data - XMind格式数据
     * @returns {Object} 标准化数据
     */
    handleXmindFormat(data) {
        const convertNode = (node) => {
            const standardNode = {
                id: node.id || this.generateId(),
                topic: node.title || node.text || '',
                data: node.data || {},
                direction: node.side || node.direction,
                expanded: node['branch-visibility'] !== 'hidden',
                children: []
            };

            if (node.children && node.children.topics) {
                standardNode.children = node.children.topics.map(convertNode);
            }

            return standardNode;
        };

        const rootTopic = data['root-topic'] || data.rootTopic;
        if (!rootTopic) {
            throw new Error('无效的XMind格式数据');
        }

        return convertNode(rootTopic);
    }

    /**
     * 处理MindManager格式
     * @param {Object} data - MindManager格式数据
     * @returns {Object} 标准化数据
     */
    handleMindmanagerFormat(data) {
        const convertNode = (node) => {
            const standardNode = {
                id: node.id || this.generateId(),
                topic: node.Text || node.text || '',
                data: {},
                children: []
            };

            // 处理属性
            if (node.Attributes && node.Attributes.Attribute) {
                const attributes = Array.isArray(node.Attributes.Attribute)
                    ? node.Attributes.Attribute
                    : [node.Attributes.Attribute];

                attributes.forEach(attr => {
                    standardNode.data[attr.Name] = attr.Value;
                });
            }

            // 处理子节点
            if (node.Topics && node.Topics.Topic) {
                const children = Array.isArray(node.Topics.Topic)
                    ? node.Topics.Topic
                    : [node.Topics.Topic];
                standardNode.children = children.map(convertNode);
            }

            return standardNode;
        };

        const map = data.Map || data.map;
        if (!map || !map.OneTopic) {
            throw new Error('无效的MindManager格式数据');
        }

        return convertNode(map.OneTopic);
    }

    /**
     * 转换为jsmind格式
     * @param {Object} standardData - 标准化数据
     * @returns {Object} jsmind格式数据
     */
    toJsmindFormat(standardData) {
        const convertNode = (node) => {
            const jsmindNode = {
                id: node.id,
                topic: node.topic,
                data: node.data
            };

            if (node.direction !== undefined) {
                jsmindNode.direction = node.direction;
            }
            if (node.expanded !== undefined) {
                jsmindNode.expanded = node.expanded;
            }
            if (node.children && node.children.length > 0) {
                jsmindNode.children = node.children.map(convertNode);
            }

            return jsmindNode;
        };

        return convertNode(standardData);
    }

    /**
     * 转换为节点树格式
     * @param {Object} standardData - 标准化数据
     * @returns {Object} 节点树格式数据
     */
    toNodeTreeFormat(standardData) {
        return this.toJsmindFormat(standardData);
    }

    /**
     * 转换为节点数组格式
     * @param {Object} standardData - 标准化数据
     * @returns {Array} 节点数组格式数据
     */
    toNodeArrayFormat(standardData) {
        const result = [];

        const traverse = (node, parentId = null) => {
            const arrayNode = {
                id: node.id,
                topic: node.topic,
                data: node.data
            };

            if (parentId) {
                arrayNode.parentid = parentId;
            }

            result.push(arrayNode);

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => {
                    traverse(child, node.id);
                });
            }
        };

        traverse(standardData);
        return result;
    }

    /**
     * 转换为FreeMind格式
     * @param {Object} standardData - 标准化数据
     * @returns {Object} FreeMind格式数据
     */
    toFreemindFormat(standardData) {
        const convertNode = (node) => {
            const freemindNode = {
                TEXT: node.topic,
                ID: node.id
            };

            // 处理属性
            if (node.data && Object.keys(node.data).length > 0) {
                const attributes = Object.entries(node.data).map(([key, value]) => ({
                    NAME: key,
                    VALUE: String(value)
                }));

                if (attributes.length === 1) {
                    freemindNode.ATTRIBUTE = attributes[0];
                } else {
                    freemindNode.ATTRIBUTE = attributes;
                }
            }

            // 处理子节点
            if (node.children && node.children.length > 0) {
                const childNodes = node.children.map(convertNode);
                freemindNode.NODE = childNodes.length === 1 ? childNodes[0] : childNodes;
            }

            return freemindNode;
        };

        return {
            map: {
                node: convertNode(standardData)
            }
        };
    }

    /**
     * 字段映射
     * @param {Object} source - 源对象
     * @param {Object} target - 目标对象
     * @param {string} fieldType - 字段类型
     */
    mapFields(source, target, fieldType) {
        const possibleFields = this.options.fieldMappings[fieldType] || [fieldType];

        for (const field of possibleFields) {
            if (source[field] !== undefined && source[field] !== null) {
                target[fieldType] = source[field];
                break;
            }
        }
    }

    /**
     * 应用兼容性处理
     * @param {Object} data - 待处理的数据
     * @returns {Object} 处理后的数据
     */
    applyCompatibility(data) {
        if (!this.options.enableCompatibility) {
            return data;
        }

        const applyCompatibilityToNode = (node) => {
            const compatibleNode = {};

            // 映射字段
            for (const [targetField, sourceFields] of Object.entries(this.options.fieldMappings)) {
                this.mapFields(node, compatibleNode, targetField);
            }

            // 处理类型转换
            if (this.options.compatibility.enableTypeConversion) {
                this.convertTypes(compatibleNode);
            }

            // 处理缺失字段
            if (this.options.compatibility.handleMissingFields) {
                this.handleMissingFields(compatibleNode);
            }

            // 保留未知字段
            if (this.options.compatibility.keepUnknownFields) {
                this.keepUnknownFields(node, compatibleNode);
            }

            // 递归处理子节点
            if (node.children && Array.isArray(node.children)) {
                compatibleNode.children = node.children.map(applyCompatibilityToNode);
            }

            return compatibleNode;
        };

        return applyCompatibilityToNode(data);
    }

    /**
     * 类型转换
     * @param {Object} node - 节点对象
     */
    convertTypes(node) {
        // 确保topic是字符串
        if (node.topic !== undefined && node.topic !== null) {
            node.topic = String(node.topic);
        }

        // 确保direction是数字
        if (node.direction !== undefined) {
            const dir = parseInt(node.direction, 10);
            if (!isNaN(dir)) {
                node.direction = dir;
            }
        }

        // 确保expanded是布尔值
        if (node.expanded !== undefined) {
            node.expanded = Boolean(node.expanded);
        }
    }

    /**
     * 处理缺失字段
     * @param {Object} node - 节点对象
     */
    handleMissingFields(node) {
        if (!node.id) {
            node.id = this.generateId();
        }

        if (!node.topic) {
            node.topic = '未命名节点';
        }

        if (!node.data) {
            node.data = {};
        }

        if (!node.children) {
            node.children = [];
        }
    }

    /**
     * 保留未知字段
     * @param {Object} source - 源对象
     * @param {Object} target - 目标对象
     */
    keepUnknownFields(source, target) {
        const allKnownFields = new Set();
        for (const fields of Object.values(this.options.fieldMappings)) {
            fields.forEach(field => allKnownFields.add(field));
        }

        for (const [key, value] of Object.entries(source)) {
            if (!allKnownFields.has(key)) {
                target[key] = value;
            }
        }
    }

    /**
     * 生成唯一ID
     * @returns {string} 唯一ID
     */
    generateId() {
        return util.uuid.newid();
    }

    /**
     * 获取支持的格式列表
     * @returns {Array<string>} 支持的格式
     */
    getSupportedFormats() {
        return Array.from(this.formatHandlers.keys());
    }

    /**
     * 检查格式是否支持
     * @param {string} format - 格式名称
     * @returns {boolean} 是否支持
     */
    isFormatSupported(format) {
        return this.formatHandlers.has(format);
    }

    /**
     * 注册格式处理器
     * @param {string} format - 格式名称
     * @param {Function} handler - 处理器函数
     */
    registerFormatHandler(format, handler) {
        if (typeof handler === 'function') {
            this.formatHandlers.set(format, handler);
        }
    }

    /**
     * 更新配置
     * @param {Object} newOptions - 新配置
     */
    updateOptions(newOptions) {
        this.options = {
            ...this.options,
            ...newOptions,
            fieldMappings: {
                ...this.options.fieldMappings,
                ...(newOptions.fieldMappings || {})
            },
            compatibility: {
                ...this.options.compatibility,
                ...(newOptions.compatibility || {})
            }
        };
    }
}