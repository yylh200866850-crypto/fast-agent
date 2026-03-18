/**
 * 知识图谱记忆技能
 * 
 * 基于知识图谱的持久化记忆系统
 * 兼容 MCP Memory Server 协议
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = createLogger('Memory');

// 内存中的图谱缓存
let graphCache = null;
let isDirty = false;

// 存储路径
const getStoragePath = () => {
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return join(dataDir, 'memory_graph.json');
};

// 初始化图谱
function initGraph() {
  if (graphCache) return graphCache;
  
  const storagePath = getStoragePath();
  
  if (existsSync(storagePath)) {
    try {
      const data = readFileSync(storagePath, 'utf-8');
      graphCache = JSON.parse(data);
    } catch (e) {
      logger.warn('加载图谱失败，创建新图谱');
      graphCache = { entities: [], relations: [] };
    }
  } else {
    graphCache = { entities: [], relations: [] };
  }
  
  return graphCache;
}

// 保存图谱
function saveGraph() {
  if (!isDirty) return;
  
  const storagePath = getStoragePath();
  writeFileSync(storagePath, JSON.stringify(graphCache, null, 2));
  isDirty = false;
}

// 生成唯一ID
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default {
  name: 'memory',
  description: '知识图谱记忆技能 - 持久化存储和检索信息',
  
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'create_entities', 'create_relations', 'add_observations',
          'delete_entities', 'delete_relations', 'delete_observations',
          'read_graph', 'search_nodes', 'open_nodes', 'clear'
        ]
      },
      entities: { type: 'array' },
      relations: { type: 'array' },
      observations: { type: 'array' },
      entityNames: { type: 'array' },
      relationIds: { type: 'array' },
      deletions: { type: 'array' },
      query: { type: 'string' },
      names: { type: 'array' }
    },
    required: ['action']
  },

  async execute(params, context) {
    const graph = initGraph();
    
    const { action, entities, relations, observations, entityNames, relationIds, deletions, query, names } = params;
    
    switch (action) {
      case 'create_entities':
        return createEntities(graph, entities || []);
        
      case 'create_relations':
        return createRelations(graph, relations || []);
        
      case 'add_observations':
        return addObservations(graph, observations || []);
        
      case 'delete_entities':
        return deleteEntities(graph, entityNames || []);
        
      case 'delete_relations':
        return deleteRelations(graph, relationIds || []);
        
      case 'delete_observations':
        return deleteObservations(graph, deletions || []);
        
      case 'read_graph':
        return readGraph(graph);
        
      case 'search_nodes':
        return searchNodes(graph, query || '');
        
      case 'open_nodes':
        return openNodes(graph, names || []);
        
      case 'clear':
        return clearGraph();
        
      default:
        throw new Error(`未知操作: ${action}`);
    }
  }
};

/**
 * 创建实体
 */
function createEntities(graph, entities) {
  const results = [];
  
  for (const entity of entities) {
    const { name, entityType, observations = [] } = entity;
    
    // 检查是否已存在
    let existing = graph.entities.find(e => e.name === name);
    
    if (existing) {
      // 合并观察
      for (const obs of observations) {
        if (!existing.observations.includes(obs)) {
          existing.observations.push(obs);
        }
      }
      results.push(existing);
    } else {
      // 创建新实体
      const newEntity = {
        id: generateId(),
        name,
        entityType: entityType || 'entity',
        observations,
        createdAt: new Date().toISOString()
      };
      graph.entities.push(newEntity);
      results.push(newEntity);
    }
  }
  
  isDirty = true;
  saveGraph();
  
  return {
    success: true,
    message: `创建了 ${results.length} 个实体`,
    entities: results
  };
}

/**
 * 创建关系
 */
function createRelations(graph, relations) {
  const results = [];
  
  for (const relation of relations) {
    const { from, to, relationType } = relation;
    
    // 检查实体是否存在
    const fromEntity = graph.entities.find(e => e.name === from);
    const toEntity = graph.entities.find(e => e.name === to);
    
    if (!fromEntity || !toEntity) {
      logger.warn(`关系创建失败: 实体不存在 (${from} -> ${to})`);
      continue;
    }
    
    // 检查关系是否已存在
    const exists = graph.relations.find(
      r => r.from === from && r.to === to && r.relationType === relationType
    );
    
    if (!exists) {
      const newRelation = {
        id: generateId(),
        from,
        to,
        relationType,
        createdAt: new Date().toISOString()
      };
      graph.relations.push(newRelation);
      results.push(newRelation);
    }
  }
  
  isDirty = true;
  saveGraph();
  
  return {
    success: true,
    message: `创建了 ${results.length} 个关系`,
    relations: results
  };
}

/**
 * 添加观察
 */
function addObservations(graph, observations) {
  const results = [];
  
  for (const obs of observations) {
    const { entityName, contents = [] } = obs;
    const entity = graph.entities.find(e => e.name === entityName);
    
    if (!entity) {
      logger.warn(`实体不存在: ${entityName}`);
      continue;
    }
    
    const added = [];
    for (const content of contents) {
      if (!entity.observations.includes(content)) {
        entity.observations.push(content);
        added.push(content);
      }
    }
    
    results.push({ entityName, added });
  }
  
  isDirty = true;
  saveGraph();
  
  return {
    success: true,
    message: '观察添加成功',
    results
  };
}

/**
 * 删除实体
 */
function deleteEntities(graph, entityNames) {
  let deletedCount = 0;
  
  for (const name of entityNames) {
    const index = graph.entities.findIndex(e => e.name === name);
    if (index !== -1) {
      graph.entities.splice(index, 1);
      deletedCount++;
      
      // 删除相关关系
      graph.relations = graph.relations.filter(
        r => r.from !== name && r.to !== name
      );
    }
  }
  
  isDirty = true;
  saveGraph();
  
  return {
    success: true,
    message: `删除了 ${deletedCount} 个实体`,
    deletedCount
  };
}

/**
 * 删除关系
 */
function deleteRelations(graph, relationIds) {
  let deletedCount = 0;
  
  for (const id of relationIds) {
    const index = graph.relations.findIndex(r => r.id === id);
    if (index !== -1) {
      graph.relations.splice(index, 1);
      deletedCount++;
    }
  }
  
  isDirty = true;
  saveGraph();
  
  return {
    success: true,
    message: `删除了 ${deletedCount} 个关系`,
    deletedCount
  };
}

/**
 * 删除观察
 */
function deleteObservations(graph, deletions) {
  const results = [];
  
  for (const deletion of deletions) {
    const { entityName, observations = [] } = deletion;
    const entity = graph.entities.find(e => e.name === entityName);
    
    if (!entity) continue;
    
    entity.observations = entity.observations.filter(
      obs => !observations.includes(obs)
    );
    results.push({ entityName, deleted: observations });
  }
  
  isDirty = true;
  saveGraph();
  
  return {
    success: true,
    message: '观察删除成功',
    results
  };
}

/**
 * 读取图谱
 */
function readGraph(graph) {
  return {
    success: true,
    graph: {
      entities: graph.entities,
      relations: graph.relations,
      stats: {
        entityCount: graph.entities.length,
        relationCount: graph.relations.length
      }
    }
  };
}

/**
 * 搜索节点
 */
function searchNodes(graph, query) {
  const lowerQuery = query.toLowerCase();
  
  const matchedEntities = graph.entities.filter(entity => {
    return entity.name.toLowerCase().includes(lowerQuery) ||
           entity.entityType.toLowerCase().includes(lowerQuery) ||
           entity.observations.some(obs => obs.toLowerCase().includes(lowerQuery));
  });
  
  const matchedRelations = graph.relations.filter(relation => {
    return relation.from.toLowerCase().includes(lowerQuery) ||
           relation.to.toLowerCase().includes(lowerQuery) ||
           relation.relationType.toLowerCase().includes(lowerQuery);
  });
  
  return {
    success: true,
    query,
    entities: matchedEntities,
    relations: matchedRelations,
    stats: {
      entityCount: matchedEntities.length,
      relationCount: matchedRelations.length
    }
  };
}

/**
 * 打开指定节点
 */
function openNodes(graph, names) {
  const entities = graph.entities.filter(e => names.includes(e.name));
  
  const relations = graph.relations.filter(
    r => names.includes(r.from) || names.includes(r.to)
  );
  
  return {
    success: true,
    entities,
    relations
  };
}

/**
 * 清空图谱
 */
function clearGraph() {
  graphCache = { entities: [], relations: [] };
  isDirty = true;
  saveGraph();
  
  return {
    success: true,
    message: '图谱已清空'
  };
}
