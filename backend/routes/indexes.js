import express from 'express';
import { getDatabase } from '../../models/database.js';

const router = express.Router();

// GET /api/indexes - List all indexes across collections
router.get('/', async (req, res) => {
  try {
    const { database, collection } = req.query;
    const db = getDatabase();
    
    let indexData = [];
    
    if (collection && collection !== 'all') {
      // Get indexes for specific collection
      const targetCollection = db.collection(collection);
      const indexes = await targetCollection.indexes();
      
      indexData = indexes.map(index => ({
        ...index,
        collection: collection,
        database: db.databaseName,
        size: index.size || 0,
        usage: index.accesses || { ops: 0, since: new Date() }
      }));
    } else {
      // Get indexes for all collections
      const collections = await db.listCollections().toArray();
      
      for (const coll of collections) {
        try {
          const targetCollection = db.collection(coll.name);
          const indexes = await targetCollection.indexes();
          
          const collectionIndexes = indexes.map(index => ({
            ...index,
            collection: coll.name,
            database: db.databaseName,
            size: index.size || 0,
            usage: index.accesses || { ops: 0, since: new Date() }
          }));
          
          indexData.push(...collectionIndexes);
        } catch (error) {
          console.warn(`Could not get indexes for collection ${coll.name}:`, error.message);
        }
      }
    }

    // Calculate index statistics
    const stats = {
      totalIndexes: indexData.length,
      totalSize: indexData.reduce((sum, idx) => sum + (idx.size || 0), 0),
      collectionsWithIndexes: [...new Set(indexData.map(idx => idx.collection))].length,
      unusedIndexes: indexData.filter(idx => (idx.usage?.ops || 0) === 0).length
    };

    res.json({
      success: true,
      data: indexData,
      stats,
      query: { database, collection: collection || 'all' }
    });

  } catch (error) {
    console.error('Index listing error:', error);
    res.status(500).json({
      error: 'Failed to retrieve indexes',
      message: error.message
    });
  }
});

// POST /api/indexes - Create new index
router.post('/', async (req, res) => {
  try {
    const { collection, indexSpec, options = {} } = req.body;
    
    if (!collection || !indexSpec) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Both "collection" and "indexSpec" are required'
      });
    }

    const db = getDatabase();
    const targetCollection = db.collection(collection);
    
    // Create the index
    const result = await targetCollection.createIndex(indexSpec, {
      background: true,
      ...options
    });

    res.json({
      success: true,
      data: {
        indexName: result,
        collection,
        indexSpec,
        options,
        created: new Date()
      },
      message: `Index "${result}" created successfully on collection "${collection}"`
    });

  } catch (error) {
    console.error('Index creation error:', error);
    res.status(500).json({
      error: 'Failed to create index',
      message: error.message
    });
  }
});

// DELETE /api/indexes - Drop index
router.delete('/', async (req, res) => {
  try {
    const { collection, indexName } = req.query;
    
    if (!collection || !indexName) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Both "collection" and "indexName" are required'
      });
    }

    // Prevent dropping the default _id index
    if (indexName === '_id_') {
      return res.status(400).json({
        error: 'Cannot drop default index',
        message: 'The _id index cannot be dropped'
      });
    }

    const db = getDatabase();
    const targetCollection = db.collection(collection);
    
    // Drop the index
    await targetCollection.dropIndex(indexName);

    res.json({
      success: true,
      message: `Index "${indexName}" dropped successfully from collection "${collection}"`
    });

  } catch (error) {
    console.error('Index deletion error:', error);
    res.status(500).json({
      error: 'Failed to drop index',
      message: error.message
    });
  }
});

// GET /api/indexes/stats - Get detailed index statistics
router.get('/stats', async (req, res) => {
  try {
    const db = getDatabase();
    const collections = await db.listCollections().toArray();
    
    let totalStats = {
      totalIndexes: 0,
      totalSize: 0,
      collectionsAnalyzed: 0,
      indexTypes: {},
      largestIndexes: [],
      recommendations: []
    };

    const allIndexes = [];

    for (const coll of collections) {
      try {
        const targetCollection = db.collection(coll.name);
        const indexes = await targetCollection.indexes();
        const stats = await targetCollection.stats();
        
        for (const index of indexes) {
          const indexInfo = {
            ...index,
            collection: coll.name,
            collectionSize: stats.size || 0,
            documentCount: stats.count || 0
          };
          
          allIndexes.push(indexInfo);
          totalStats.totalIndexes++;
          totalStats.totalSize += index.size || 0;
          
          // Track index types
          const indexType = getIndexType(index.key);
          totalStats.indexTypes[indexType] = (totalStats.indexTypes[indexType] || 0) + 1;
        }
        
        totalStats.collectionsAnalyzed++;
      } catch (error) {
        console.warn(`Could not analyze collection ${coll.name}:`, error.message);
      }
    }

    // Find largest indexes
    totalStats.largestIndexes = allIndexes
      .sort((a, b) => (b.size || 0) - (a.size || 0))
      .slice(0, 10)
      .map(idx => ({
        name: idx.name,
        collection: idx.collection,
        size: idx.size || 0,
        keys: idx.key
      }));

    // Generate recommendations
    totalStats.recommendations = generateIndexRecommendations(allIndexes);

    res.json({
      success: true,
      data: totalStats
    });

  } catch (error) {
    console.error('Index stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve index statistics',
      message: error.message
    });
  }
});

// Helper functions
function getIndexType(keySpec) {
  const keys = Object.keys(keySpec);
  const values = Object.values(keySpec);
  
  if (keys.length === 1) {
    if (values[0] === 1 || values[0] === -1) return 'Single Field';
    if (values[0] === '2d') return '2D Geospatial';
    if (values[0] === '2dsphere') return '2D Sphere';
    if (values[0] === 'text') return 'Text';
    if (values[0] === 'hashed') return 'Hashed';
  }
  
  if (keys.length > 1) {
    if (values.every(v => v === 1 || v === -1)) return 'Compound';
    if (values.some(v => v === 'text')) return 'Text Compound';
  }
  
  return 'Other';
}

function generateIndexRecommendations(indexes) {
  const recommendations = [];
  
  // Find unused indexes
  const unusedIndexes = indexes.filter(idx => 
    idx.name !== '_id_' && (idx.usage?.ops || 0) === 0
  );
  
  if (unusedIndexes.length > 0) {
    recommendations.push({
      type: 'unused_indexes',
      priority: 'medium',
      count: unusedIndexes.length,
      message: `${unusedIndexes.length} unused indexes detected`,
      description: 'Consider dropping unused indexes to improve write performance and reduce storage',
      indexes: unusedIndexes.map(idx => ({
        name: idx.name,
        collection: idx.collection,
        size: idx.size || 0
      }))
    });
  }
  
  // Find large indexes
  const largeIndexes = indexes.filter(idx => (idx.size || 0) > 100 * 1024 * 1024); // > 100MB
  
  if (largeIndexes.length > 0) {
    recommendations.push({
      type: 'large_indexes',
      priority: 'low',
      count: largeIndexes.length,
      message: `${largeIndexes.length} large indexes found`,
      description: 'Monitor large indexes for performance impact',
      indexes: largeIndexes.map(idx => ({
        name: idx.name,
        collection: idx.collection,
        size: idx.size || 0
      }))
    });
  }
  
  // Find collections without custom indexes
  const collectionsWithoutIndexes = [...new Set(indexes.map(idx => idx.collection))]
    .filter(collection => {
      const collectionIndexes = indexes.filter(idx => idx.collection === collection);
      return collectionIndexes.length === 1 && collectionIndexes[0].name === '_id_';
    });
  
  if (collectionsWithoutIndexes.length > 0) {
    recommendations.push({
      type: 'missing_indexes',
      priority: 'high',
      count: collectionsWithoutIndexes.length,
      message: `${collectionsWithoutIndexes.length} collections have only default _id index`,
      description: 'Consider adding indexes based on your query patterns',
      collections: collectionsWithoutIndexes
    });
  }
  
  return recommendations;
}

export default router;