import { MongoClient, ObjectId } from 'mongodb';
import { getMongodService } from './mongod_service.js';

// 连接池缓存
const clients = new Map();

// 默认 URI (本地 mongod 服务)
let defaultUri = null;
let defaultDbName = 'fast_agent';

/**
 * 设置默认 MongoDB 连接
 */
export function setDefaultConnection(uri, dbName = 'fast_agent') {
  defaultUri = uri;
  defaultDbName = dbName;
}

/**
 * 获取默认 URI
 */
export function getDefaultUri() {
  if (!defaultUri) {
    // 尝试从 mongod 服务获取
    const service = getMongodService();
    defaultUri = service.getUri();
    defaultDbName = service.getDbName();
  }
  return defaultUri;
}

/**
 * 获取默认数据库名
 */
export function getDefaultDbName() {
  return defaultDbName;
}

// 获取或创建连接
async function getClient(uri) {
  // 如果未提供 URI，使用默认连接
  const connectionUri = uri || getDefaultUri();
  if (!clients.has(connectionUri)) {
    const client = new MongoClient(connectionUri);
    await client.connect();
    clients.set(connectionUri, client);
  }
  return clients.get(connectionUri);
}

// MongoDB 工具定义
export const mongoTools = [
  {
    name: 'mongo_find',
    description: '查询文档 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选，默认使用内置服务)' },
        database: { type: 'string', description: '数据库名 (可选，默认 fast_agent)' },
        collection: { type: 'string', description: '集合名' },
        filter: { type: 'object', description: '查询条件', default: {} },
        projection: { type: 'object', description: '字段投影' },
        sort: { type: 'object', description: '排序' },
        limit: { type: 'number', description: '限制数量', default: 100 },
        skip: { type: 'number', description: '跳过数量', default: 0 }
      },
      required: ['collection']
    }
  },
  {
    name: 'mongo_findOne',
    description: '查询单个文档 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' },
        database: { type: 'string', description: '数据库名 (可选，默认 fast_agent)' },
        collection: { type: 'string', description: '集合名' },
        filter: { type: 'object', description: '查询条件', default: {} },
        projection: { type: 'object', description: '字段投影' }
      },
      required: ['collection']
    }
  },
  {
    name: 'mongo_insertOne',
    description: '插入单个文档 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' },
        database: { type: 'string', description: '数据库名 (可选)' },
        collection: { type: 'string', description: '集合名' },
        document: { type: 'object', description: '要插入的文档' }
      },
      required: ['collection', 'document']
    }
  },
  {
    name: 'mongo_insertMany',
    description: '插入多个文档 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' },
        database: { type: 'string', description: '数据库名 (可选)' },
        collection: { type: 'string', description: '集合名' },
        documents: { type: 'array', description: '要插入的文档数组', items: { type: 'object' } }
      },
      required: ['collection', 'documents']
    }
  },
  {
    name: 'mongo_updateOne',
    description: '更新单个文档 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' },
        database: { type: 'string', description: '数据库名 (可选)' },
        collection: { type: 'string', description: '集合名' },
        filter: { type: 'object', description: '查询条件' },
        update: { type: 'object', description: '更新操作' },
        upsert: { type: 'boolean', description: '不存在时插入', default: false }
      },
      required: ['collection', 'filter', 'update']
    }
  },
  {
    name: 'mongo_updateMany',
    description: '更新多个文档 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' },
        database: { type: 'string', description: '数据库名 (可选)' },
        collection: { type: 'string', description: '集合名' },
        filter: { type: 'object', description: '查询条件' },
        update: { type: 'object', description: '更新操作' }
      },
      required: ['collection', 'filter', 'update']
    }
  },
  {
    name: 'mongo_deleteOne',
    description: '删除单个文档 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' },
        database: { type: 'string', description: '数据库名 (可选)' },
        collection: { type: 'string', description: '集合名' },
        filter: { type: 'object', description: '查询条件' }
      },
      required: ['collection', 'filter']
    }
  },
  {
    name: 'mongo_deleteMany',
    description: '删除多个文档 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' },
        database: { type: 'string', description: '数据库名 (可选)' },
        collection: { type: 'string', description: '集合名' },
        filter: { type: 'object', description: '查询条件' }
      },
      required: ['collection', 'filter']
    }
  },
  {
    name: 'mongo_aggregate',
    description: '聚合查询 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' },
        database: { type: 'string', description: '数据库名 (可选)' },
        collection: { type: 'string', description: '集合名' },
        pipeline: { type: 'array', description: '聚合管道', items: { type: 'object' } }
      },
      required: ['collection', 'pipeline']
    }
  },
  {
    name: 'mongo_count',
    description: '统计文档数量 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' },
        database: { type: 'string', description: '数据库名 (可选)' },
        collection: { type: 'string', description: '集合名' },
        filter: { type: 'object', description: '查询条件', default: {} }
      },
      required: ['collection']
    }
  },
  {
    name: 'mongo_listDatabases',
    description: '列出所有数据库 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' }
      },
      required: []
    }
  },
  {
    name: 'mongo_listCollections',
    description: '列出数据库中的所有集合 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' },
        database: { type: 'string', description: '数据库名 (可选)' }
      },
      required: []
    }
  },
  {
    name: 'mongo_createDatabase',
    description: '创建新数据库 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' },
        database: { type: 'string', description: '要创建的数据库名' }
      },
      required: ['database']
    }
  },
  {
    name: 'mongo_createUser',
    description: '创建新用户并设置密码和角色 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' },
        username: { type: 'string', description: '用户名' },
        password: { type: 'string', description: '密码' },
        database: { type: 'string', description: '用户所属数据库', default: 'admin' },
        roles: { 
          type: 'array', 
          description: '角色列表，每个角色包含 role 和 db 字段',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', description: '角色名 (如 read, readWrite, dbAdmin, userAdmin 等)' },
              db: { type: 'string', description: '角色应用的数据库' }
            },
            required: ['role', 'db']
          },
          default: [{ role: 'readWrite', db: 'test' }]
        }
      },
      required: ['username', 'password']
    }
  },
  {
    name: 'mongo_updateUserPassword',
    description: '更新用户密码 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' },
        username: { type: 'string', description: '用户名' },
        password: { type: 'string', description: '新密码' },
        database: { type: 'string', description: '用户所属数据库', default: 'admin' }
      },
      required: ['username', 'password']
    }
  },
  {
    name: 'mongo_deleteUser',
    description: '删除用户 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' },
        username: { type: 'string', description: '用户名' },
        database: { type: 'string', description: '用户所属数据库', default: 'admin' }
      },
      required: ['username']
    }
  },
  {
    name: 'mongo_listUsers',
    description: '列出指定数据库的所有用户 (不传 uri 则使用内置 MongoDB 服务)',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'MongoDB 连接字符串 (可选)' },
        database: { type: 'string', description: '数据库名', default: 'admin' }
      },
      required: []
    }
  },
  {
    name: 'mongo_status',
    description: '获取内置 MongoDB 服务状态',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// 处理 ObjectId
function processFilter(filter) {
  if (!filter) return {};
  const processed = { ...filter };
  if (processed._id && typeof processed._id === 'string') {
    processed._id = new ObjectId(processed._id);
  }
  return processed;
}

// 获取集合 (支持默认参数)
async function getCollection(uri, database, collection) {
  const client = await getClient(uri);
  const dbName = database || getDefaultDbName();
  return client.db(dbName).collection(collection);
}

// 工具处理函数
export async function handleMongoTool(name, args) {
  const text = (content) => ({ content: [{ type: 'text', text: typeof content === 'string' ? content : JSON.stringify(content, null, 2) }] });
  
  switch (name) {
    case 'mongo_find': {
      const col = await getCollection(args.uri, args.database, args.collection);
      let cursor = col.find(processFilter(args.filter));
      if (args.projection) cursor = cursor.project(args.projection);
      if (args.sort) cursor = cursor.sort(args.sort);
      if (args.skip) cursor = cursor.skip(args.skip);
      if (args.limit) cursor = cursor.limit(args.limit);
      const docs = await cursor.toArray();
      return text(docs);
    }
    
    case 'mongo_findOne': {
      const col = await getCollection(args.uri, args.database, args.collection);
      const doc = await col.findOne(processFilter(args.filter), { projection: args.projection });
      return text(doc);
    }
    
    case 'mongo_insertOne': {
      const col = await getCollection(args.uri, args.database, args.collection);
      const result = await col.insertOne(args.document);
      return text({ insertedId: result.insertedId });
    }
    
    case 'mongo_insertMany': {
      const col = await getCollection(args.uri, args.database, args.collection);
      const result = await col.insertMany(args.documents);
      return text({ insertedCount: result.insertedCount, insertedIds: result.insertedIds });
    }
    
    case 'mongo_updateOne': {
      const col = await getCollection(args.uri, args.database, args.collection);
      const result = await col.updateOne(processFilter(args.filter), args.update, { upsert: args.upsert });
      return text({ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, upsertedId: result.upsertedId });
    }
    
    case 'mongo_updateMany': {
      const col = await getCollection(args.uri, args.database, args.collection);
      const result = await col.updateMany(processFilter(args.filter), args.update);
      return text({ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount });
    }
    
    case 'mongo_deleteOne': {
      const col = await getCollection(args.uri, args.database, args.collection);
      const result = await col.deleteOne(processFilter(args.filter));
      return text({ deletedCount: result.deletedCount });
    }
    
    case 'mongo_deleteMany': {
      const col = await getCollection(args.uri, args.database, args.collection);
      const result = await col.deleteMany(processFilter(args.filter));
      return text({ deletedCount: result.deletedCount });
    }
    
    case 'mongo_aggregate': {
      const col = await getCollection(args.uri, args.database, args.collection);
      const docs = await col.aggregate(args.pipeline).toArray();
      return text(docs);
    }
    
    case 'mongo_count': {
      const col = await getCollection(args.uri, args.database, args.collection);
      const count = await col.countDocuments(processFilter(args.filter));
      return text({ count });
    }
    
    case 'mongo_listDatabases': {
      const client = await getClient(args.uri);
      const result = await client.db().admin().listDatabases();
      return text(result.databases);
    }
    
    case 'mongo_listCollections': {
      const client = await getClient(args.uri);
      const dbName = args.database || getDefaultDbName();
      const collections = await client.db(dbName).listCollections().toArray();
      return text(collections.map(c => c.name));
    }
    
    case 'mongo_createDatabase': {
      // MongoDB 中创建数据库实际上是通过在该数据库中创建第一个集合/文档来实现的
      const client = await getClient(args.uri);
      const db = client.db(args.database);
      // 创建一个临时集合并插入一个文档，然后删除它，这样就能创建数据库
      const tempCollection = db.collection('_temp_init_');
      await tempCollection.insertOne({ _id: 'init', createdAt: new Date() });
      await tempCollection.drop();
      return text({ success: true, message: `数据库 ${args.database} 创建成功` });
    }
    
    case 'mongo_createUser': {
      const client = await getClient(args.uri);
      const db = client.db(args.database || 'admin');
      const roles = args.roles || [{ role: 'readWrite', db: args.database || 'test' }];
      
      try {
        await db.command({
          createUser: args.username,
          pwd: args.password,
          roles: roles
        });
        return text({ 
          success: true, 
          message: `用户 ${args.username} 创建成功`,
          username: args.username,
          database: args.database || 'admin',
          roles: roles
        });
      } catch (error) {
        return { content: [{ type: 'text', text: `创建用户失败：${error.message}` }], isError: true };
      }
    }
    
    case 'mongo_updateUserPassword': {
      const client = await getClient(args.uri);
      const db = client.db(args.database || 'admin');
      
      try {
        await db.command({
          updateUser: args.username,
          pwd: args.password
        });
        return text({ 
          success: true, 
          message: `用户 ${args.username} 密码更新成功`
        });
      } catch (error) {
        return { content: [{ type: 'text', text: `更新密码失败：${error.message}` }], isError: true };
      }
    }
    
    case 'mongo_deleteUser': {
      const client = await getClient(args.uri);
      const db = client.db(args.database || 'admin');
      
      try {
        await db.command({
          dropUser: args.username
        });
        return text({ 
          success: true, 
          message: `用户 ${args.username} 删除成功`
        });
      } catch (error) {
        return { content: [{ type: 'text', text: `删除用户失败：${error.message}` }], isError: true };
      }
    }
    
    case 'mongo_listUsers': {
      const client = await getClient(args.uri);
      const db = client.db(args.database || 'admin');
      
      try {
        const result = await db.command({
          usersInfo: 1
        });
        return text({
          database: args.database || 'admin',
          users: result.users || []
        });
      } catch (error) {
        return { content: [{ type: 'text', text: `获取用户列表失败：${error.message}` }], isError: true };
      }
    }
    
    case 'mongo_status': {
      const service = getMongodService();
      const info = service.getInfo();
      const isRunning = await service.checkStatus();
      return text({
        ...info,
        running: isRunning,
        defaultDatabase: getDefaultDbName(),
        connectionUri: getDefaultUri()
      });
    }
    
    default:
      return { content: [{ type: 'text', text: `Unknown mongo tool: ${name}` }], isError: true };
  }
}
