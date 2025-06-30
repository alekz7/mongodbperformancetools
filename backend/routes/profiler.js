import express from 'express';
import { getDatabase } from '../../models/database.js';

const router = express.Router();

// GET /api/profiler - Retrieve profiler data
router.get('/', async (req, res) => {
  try {
    const { from, to, collection, limit = 100 } = req.query;
    
    // Validate query parameters
    if (!from || !to) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Both "from" and "to" date parameters are required'
      });
    }

    const db = getDatabase();
    const profileCollection = db.collection('system.profile');
    
    // Build query filter
    const query = {
      ts: {
        $gte: new Date(from),
        $lte: new Date(to)
      }
    };

    // Add collection filter if specified
    if (collection && collection !== 'all') {
      query.ns = new RegExp(`\\.${collection}$`);
    }

    // Query profiler data
    const profilerData = await profileCollection
      .find(query)
      .sort({ ts: -1 })
      .limit(parseInt(limit))
      .toArray();

    // Transform data to match Studio3T format with unique IDs
    const transformedData = profilerData.map((doc, index) => ({
      queryId: doc._id ? doc._id.toString() : `query_${Date.now()}_${index}`,
      queryText: JSON.stringify(doc.command || doc.query || {}),
      executionTime: doc.millis || doc.duration || 0,
      keysExamined: doc.keysExamined || doc.executionStats?.keysExamined || 0,
      docsExamined: doc.docsExamined || doc.executionStats?.docsExamined || 0,
      docsReturned: doc.docsReturned || doc.executionStats?.docsReturned || 0,
      ts: doc.ts,
      namespace: doc.ns,
      operation: doc.op || 'unknown',
      planSummary: doc.planSummary || null,
      originalDoc: doc // Store original for explain plan reconstruction
    }));

    res.json({
      success: true,
      data: transformedData,
      total: transformedData.length,
      query: {
        from,
        to,
        collection: collection || 'all',
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Profiler query error:', error);
    res.status(500).json({
      error: 'Failed to retrieve profiler data',
      message: error.message
    });
  }
});

// GET /api/profiler/explain?queryId= - Get explain plan for a specific query
router.get('/explain', async (req, res) => {
  try {
    const { queryId } = req.query;
    
    if (!queryId) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'Parameter "queryId" is required'
      });
    }

    const db = getDatabase();
    const profileCollection = db.collection('system.profile');
    
    // Find the original profiler document
    let profileDoc;
    try {
      // Try to find by ObjectId first
      const { ObjectId } = await import('mongodb');
      profileDoc = await profileCollection.findOne({ _id: new ObjectId(queryId) });
    } catch (error) {
      // If ObjectId fails, try to find by string match or other criteria
      profileDoc = await profileCollection.findOne({
        $or: [
          { _id: queryId },
          { 'command.comment': queryId }
        ]
      });
    }

    if (!profileDoc) {
      return res.status(404).json({
        error: 'Query not found',
        message: `No profiler data found for queryId: ${queryId}`
      });
    }

    // Extract query details for explain plan
    const command = profileDoc.command || profileDoc.query || {};
    const namespace = profileDoc.ns;
    
    if (!namespace) {
      return res.status(400).json({
        error: 'Invalid query data',
        message: 'Cannot determine collection from profiler data'
      });
    }

    // Parse namespace to get database and collection
    const [dbName, collectionName] = namespace.split('.', 2);
    
    if (!collectionName) {
      return res.status(400).json({
        error: 'Invalid namespace',
        message: `Cannot parse collection from namespace: ${namespace}`
      });
    }

    // Get the target collection
    const targetDb = db.client ? db.client.db(dbName) : db;
    const targetCollection = targetDb.collection(collectionName);

    let explainResult;

    try {
      // Generate explain plan based on operation type
      switch (profileDoc.op) {
        case 'query':
        case 'find':
          explainResult = await targetCollection
            .find(command.filter || command.query || {})
            .sort(command.sort || {})
            .limit(command.limit || 0)
            .skip(command.skip || 0)
            .explain('executionStats');
          break;

        case 'update':
          explainResult = await targetCollection
            .updateMany(command.q || command.filter || {}, command.u || command.update || {})
            .explain('executionStats');
          break;

        case 'delete':
        case 'remove':
          explainResult = await targetCollection
            .deleteMany(command.q || command.filter || {})
            .explain('executionStats');
          break;

        case 'count':
          explainResult = await targetCollection
            .countDocuments(command.query || command.filter || {})
            .explain('executionStats');
          break;

        case 'aggregate':
          if (command.pipeline && Array.isArray(command.pipeline)) {
            explainResult = await targetCollection
              .aggregate(command.pipeline)
              .explain('executionStats');
          } else {
            throw new Error('Invalid aggregation pipeline');
          }
          break;

        default:
          // For unknown operations, try to reconstruct a basic find query
          explainResult = await targetCollection
            .find(command.filter || command.query || {})
            .explain('executionStats');
      }

      // Transform explain result to Studio3T format
      const transformedExplain = {
        queryId,
        namespace,
        operation: profileDoc.op,
        originalQuery: command,
        explainPlan: {
          queryPlanner: explainResult.queryPlanner || {},
          executionStats: explainResult.executionStats || {},
          serverInfo: explainResult.serverInfo || {},
          
          // Key performance metrics
          performance: {
            executionTimeMillis: explainResult.executionStats?.executionTimeMillis || profileDoc.millis || 0,
            totalKeysExamined: explainResult.executionStats?.totalKeysExamined || profileDoc.keysExamined || 0,
            totalDocsExamined: explainResult.executionStats?.totalDocsExamined || profileDoc.docsExamined || 0,
            totalDocsReturned: explainResult.executionStats?.totalDocsReturned || profileDoc.docsReturned || 0,
            indexesUsed: extractIndexesUsed(explainResult),
            isCollectionScan: isCollectionScan(explainResult),
            efficiency: calculateEfficiency(explainResult, profileDoc)
          },

          // Index recommendations
          recommendations: generateIndexRecommendations(explainResult, command),
          
          // Execution stages breakdown
          stages: extractExecutionStages(explainResult)
        },
        
        // Original profiler data for context
        profilerData: {
          timestamp: profileDoc.ts,
          executionTime: profileDoc.millis || 0,
          planSummary: profileDoc.planSummary,
          client: profileDoc.client,
          user: profileDoc.user
        }
      };

      res.json({
        success: true,
        data: transformedExplain
      });

    } catch (explainError) {
      console.error('Explain plan generation error:', explainError);
      
      // Return partial data with error information
      res.json({
        success: false,
        error: 'Failed to generate explain plan',
        message: explainError.message,
        data: {
          queryId,
          namespace,
          operation: profileDoc.op,
          originalQuery: command,
          profilerData: {
            timestamp: profileDoc.ts,
            executionTime: profileDoc.millis || 0,
            planSummary: profileDoc.planSummary,
            client: profileDoc.client,
            user: profileDoc.user
          },
          explainPlan: null
        }
      });
    }

  } catch (error) {
    console.error('Explain route error:', error);
    res.status(500).json({
      error: 'Failed to retrieve explain plan',
      message: error.message
    });
  }
});

// GET /api/profiler/stats - Get profiler statistics
router.get('/stats', async (req, res) => {
  try {
    const db = getDatabase();
    const profileCollection = db.collection('system.profile');
    
    const stats = await profileCollection.aggregate([
      {
        $group: {
          _id: null,
          totalQueries: { $sum: 1 },
          avgExecutionTime: { $avg: '$millis' },
          maxExecutionTime: { $max: '$millis' },
          totalKeysExamined: { $sum: '$keysExamined' }
        }
      }
    ]).toArray();

    const operationStats = await profileCollection.aggregate([
      {
        $group: {
          _id: '$op',
          count: { $sum: 1 },
          avgTime: { $avg: '$millis' }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalQueries: 0,
          avgExecutionTime: 0,
          maxExecutionTime: 0,
          totalKeysExamined: 0
        },
        operationBreakdown: operationStats
      }
    });

  } catch (error) {
    console.error('Stats query error:', error);
    res.status(500).json({
      error: 'Failed to retrieve profiler statistics',
      message: error.message
    });
  }
});

// Helper functions for explain plan analysis
function extractIndexesUsed(explainResult) {
  const indexes = [];
  
  function traverseStages(stage) {
    if (stage.indexName) {
      indexes.push(stage.indexName);
    }
    if (stage.inputStage) {
      traverseStages(stage.inputStage);
    }
    if (stage.inputStages) {
      stage.inputStages.forEach(traverseStages);
    }
  }
  
  if (explainResult.executionStats?.executionStages) {
    traverseStages(explainResult.executionStats.executionStages);
  }
  
  return [...new Set(indexes)]; // Remove duplicates
}

function isCollectionScan(explainResult) {
  function checkForCollScan(stage) {
    if (stage.stage === 'COLLSCAN') return true;
    if (stage.inputStage) return checkForCollScan(stage.inputStage);
    if (stage.inputStages) return stage.inputStages.some(checkForCollScan);
    return false;
  }
  
  if (explainResult.executionStats?.executionStages) {
    return checkForCollScan(explainResult.executionStats.executionStages);
  }
  
  return false;
}

function calculateEfficiency(explainResult, profileDoc) {
  const stats = explainResult.executionStats || {};
  const examined = stats.totalDocsExamined || profileDoc.docsExamined || 0;
  const returned = stats.totalDocsReturned || profileDoc.docsReturned || 0;
  
  if (examined === 0) return 100;
  if (returned === 0) return 0;
  
  return Math.round((returned / examined) * 100);
}

function generateIndexRecommendations(explainResult, command) {
  const recommendations = [];
  
  // Check if collection scan is happening
  if (isCollectionScan(explainResult)) {
    const filter = command.filter || command.query || command.q || {};
    const sort = command.sort || {};
    
    if (Object.keys(filter).length > 0) {
      recommendations.push({
        type: 'missing_index',
        priority: 'high',
        message: 'Consider creating an index on the query filter fields',
        suggestedIndex: filter,
        reason: 'Collection scan detected - query is examining all documents'
      });
    }
    
    if (Object.keys(sort).length > 0) {
      recommendations.push({
        type: 'sort_index',
        priority: 'medium',
        message: 'Consider creating an index to support sorting',
        suggestedIndex: { ...filter, ...sort },
        reason: 'Sort operation may benefit from an index'
      });
    }
  }
  
  // Check efficiency
  const stats = explainResult.executionStats || {};
  const examined = stats.totalDocsExamined || 0;
  const returned = stats.totalDocsReturned || 0;
  
  if (examined > 0 && returned > 0) {
    const efficiency = (returned / examined) * 100;
    if (efficiency < 10) {
      recommendations.push({
        type: 'low_efficiency',
        priority: 'medium',
        message: `Query efficiency is low (${efficiency.toFixed(1)}%)`,
        reason: `Examining ${examined} documents to return ${returned} results`
      });
    }
  }
  
  return recommendations;
}

function extractExecutionStages(explainResult) {
  const stages = [];
  
  function traverseStages(stage, depth = 0) {
    stages.push({
      stage: stage.stage,
      depth,
      executionTimeMillisEstimate: stage.executionTimeMillisEstimate || 0,
      works: stage.works || 0,
      advanced: stage.advanced || 0,
      needTime: stage.needTime || 0,
      needYield: stage.needYield || 0,
      isEOF: stage.isEOF || false,
      indexName: stage.indexName || null,
      direction: stage.direction || null,
      docsExamined: stage.docsExamined || 0,
      keysExamined: stage.keysExamined || 0
    });
    
    if (stage.inputStage) {
      traverseStages(stage.inputStage, depth + 1);
    }
    if (stage.inputStages) {
      stage.inputStages.forEach(s => traverseStages(s, depth + 1));
    }
  }
  
  if (explainResult.executionStats?.executionStages) {
    traverseStages(explainResult.executionStats.executionStages);
  }
  
  return stages;
}

export default router;