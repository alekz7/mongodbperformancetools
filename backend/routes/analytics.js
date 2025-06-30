import express from 'express';
import { getDatabase } from '../../models/database.js';

const router = express.Router();

// GET /api/analytics/performance-trends - Get performance trends over time
router.get('/performance-trends', async (req, res) => {
  try {
    const { from, to, collection, interval = 'hour' } = req.query;
    
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

    if (collection && collection !== 'all') {
      query.ns = new RegExp(`\\.${collection}$`);
    }

    // Define grouping based on interval
    let dateGrouping;
    switch (interval) {
      case 'minute':
        dateGrouping = {
          year: { $year: '$ts' },
          month: { $month: '$ts' },
          day: { $dayOfMonth: '$ts' },
          hour: { $hour: '$ts' },
          minute: { $minute: '$ts' }
        };
        break;
      case 'hour':
        dateGrouping = {
          year: { $year: '$ts' },
          month: { $month: '$ts' },
          day: { $dayOfMonth: '$ts' },
          hour: { $hour: '$ts' }
        };
        break;
      case 'day':
        dateGrouping = {
          year: { $year: '$ts' },
          month: { $month: '$ts' },
          day: { $dayOfMonth: '$ts' }
        };
        break;
      default:
        dateGrouping = {
          year: { $year: '$ts' },
          month: { $month: '$ts' },
          day: { $dayOfMonth: '$ts' },
          hour: { $hour: '$ts' }
        };
    }

    const trends = await profileCollection.aggregate([
      { $match: query },
      {
        $group: {
          _id: dateGrouping,
          avgExecutionTime: { $avg: '$millis' },
          maxExecutionTime: { $max: '$millis' },
          minExecutionTime: { $min: '$millis' },
          totalQueries: { $sum: 1 },
          avgKeysExamined: { $avg: '$keysExamined' },
          avgDocsExamined: { $avg: '$docsExamined' },
          avgDocsReturned: { $avg: '$docsReturned' },
          slowQueries: {
            $sum: {
              $cond: [{ $gt: ['$millis', 100] }, 1, 0]
            }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1, '_id.minute': 1 } }
    ]).toArray();

    // Transform data for charting
    const chartData = trends.map(trend => {
      const date = new Date(
        trend._id.year,
        (trend._id.month || 1) - 1,
        trend._id.day || 1,
        trend._id.hour || 0,
        trend._id.minute || 0
      );

      return {
        timestamp: date.toISOString(),
        avgExecutionTime: Math.round(trend.avgExecutionTime || 0),
        maxExecutionTime: trend.maxExecutionTime || 0,
        minExecutionTime: trend.minExecutionTime || 0,
        totalQueries: trend.totalQueries,
        avgKeysExamined: Math.round(trend.avgKeysExamined || 0),
        avgDocsExamined: Math.round(trend.avgDocsExamined || 0),
        avgDocsReturned: Math.round(trend.avgDocsReturned || 0),
        slowQueries: trend.slowQueries,
        efficiency: trend.avgDocsExamined > 0 ? 
          Math.round((trend.avgDocsReturned / trend.avgDocsExamined) * 100) : 100
      };
    });

    res.json({
      success: true,
      data: chartData,
      query: { from, to, collection: collection || 'all', interval }
    });

  } catch (error) {
    console.error('Performance trends error:', error);
    res.status(500).json({
      error: 'Failed to retrieve performance trends',
      message: error.message
    });
  }
});

// GET /api/analytics/operation-breakdown - Get operation type breakdown
router.get('/operation-breakdown', async (req, res) => {
  try {
    const { from, to, collection } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Both "from" and "to" date parameters are required'
      });
    }

    const db = getDatabase();
    const profileCollection = db.collection('system.profile');
    
    const query = {
      ts: {
        $gte: new Date(from),
        $lte: new Date(to)
      }
    };

    if (collection && collection !== 'all') {
      query.ns = new RegExp(`\\.${collection}$`);
    }

    const breakdown = await profileCollection.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$op',
          count: { $sum: 1 },
          avgExecutionTime: { $avg: '$millis' },
          totalExecutionTime: { $sum: '$millis' },
          avgKeysExamined: { $avg: '$keysExamined' },
          avgDocsExamined: { $avg: '$docsExamined' }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    const chartData = breakdown.map(op => ({
      operation: op._id || 'unknown',
      count: op.count,
      avgExecutionTime: Math.round(op.avgExecutionTime || 0),
      totalExecutionTime: Math.round(op.totalExecutionTime || 0),
      avgKeysExamined: Math.round(op.avgKeysExamined || 0),
      avgDocsExamined: Math.round(op.avgDocsExamined || 0),
      percentage: 0 // Will be calculated on frontend
    }));

    res.json({
      success: true,
      data: chartData,
      query: { from, to, collection: collection || 'all' }
    });

  } catch (error) {
    console.error('Operation breakdown error:', error);
    res.status(500).json({
      error: 'Failed to retrieve operation breakdown',
      message: error.message
    });
  }
});

// GET /api/analytics/collection-performance - Get per-collection performance metrics
router.get('/collection-performance', async (req, res) => {
  try {
    const { from, to } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Both "from" and "to" date parameters are required'
      });
    }

    const db = getDatabase();
    const profileCollection = db.collection('system.profile');
    
    const query = {
      ts: {
        $gte: new Date(from),
        $lte: new Date(to)
      }
    };

    const performance = await profileCollection.aggregate([
      { $match: query },
      {
        $addFields: {
          collection: {
            $arrayElemAt: [
              { $split: ['$ns', '.'] },
              -1
            ]
          }
        }
      },
      {
        $group: {
          _id: '$collection',
          totalQueries: { $sum: 1 },
          avgExecutionTime: { $avg: '$millis' },
          maxExecutionTime: { $max: '$millis' },
          totalExecutionTime: { $sum: '$millis' },
          avgKeysExamined: { $avg: '$keysExamined' },
          avgDocsExamined: { $avg: '$docsExamined' },
          avgDocsReturned: { $avg: '$docsReturned' },
          slowQueries: {
            $sum: {
              $cond: [{ $gt: ['$millis', 100] }, 1, 0]
            }
          }
        }
      },
      { $sort: { totalQueries: -1 } }
    ]).toArray();

    const chartData = performance.map(coll => ({
      collection: coll._id || 'unknown',
      totalQueries: coll.totalQueries,
      avgExecutionTime: Math.round(coll.avgExecutionTime || 0),
      maxExecutionTime: coll.maxExecutionTime || 0,
      totalExecutionTime: Math.round(coll.totalExecutionTime || 0),
      avgKeysExamined: Math.round(coll.avgKeysExamined || 0),
      avgDocsExamined: Math.round(coll.avgDocsExamined || 0),
      avgDocsReturned: Math.round(coll.avgDocsReturned || 0),
      slowQueries: coll.slowQueries,
      efficiency: coll.avgDocsExamined > 0 ? 
        Math.round((coll.avgDocsReturned / coll.avgDocsExamined) * 100) : 100,
      slowQueryPercentage: Math.round((coll.slowQueries / coll.totalQueries) * 100)
    }));

    res.json({
      success: true,
      data: chartData,
      query: { from, to }
    });

  } catch (error) {
    console.error('Collection performance error:', error);
    res.status(500).json({
      error: 'Failed to retrieve collection performance',
      message: error.message
    });
  }
});

// POST /api/analytics/compare-periods - Compare performance between two time periods
router.post('/compare-periods', async (req, res) => {
  try {
    const { 
      beforePeriod: { from: beforeFrom, to: beforeTo },
      afterPeriod: { from: afterFrom, to: afterTo },
      collection 
    } = req.body;
    
    if (!beforeFrom || !beforeTo || !afterFrom || !afterTo) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Both before and after periods with from/to dates are required'
      });
    }

    const db = getDatabase();
    const profileCollection = db.collection('system.profile');
    
    // Build base query
    const baseQuery = {};
    if (collection && collection !== 'all') {
      baseQuery.ns = new RegExp(`\\.${collection}$`);
    }

    // Get before period stats
    const beforeStats = await profileCollection.aggregate([
      { 
        $match: { 
          ...baseQuery,
          ts: { $gte: new Date(beforeFrom), $lte: new Date(beforeTo) }
        }
      },
      {
        $group: {
          _id: null,
          totalQueries: { $sum: 1 },
          avgExecutionTime: { $avg: '$millis' },
          maxExecutionTime: { $max: '$millis' },
          avgKeysExamined: { $avg: '$keysExamined' },
          avgDocsExamined: { $avg: '$docsExamined' },
          avgDocsReturned: { $avg: '$docsReturned' },
          slowQueries: {
            $sum: { $cond: [{ $gt: ['$millis', 100] }, 1, 0] }
          }
        }
      }
    ]).toArray();

    // Get after period stats
    const afterStats = await profileCollection.aggregate([
      { 
        $match: { 
          ...baseQuery,
          ts: { $gte: new Date(afterFrom), $lte: new Date(afterTo) }
        }
      },
      {
        $group: {
          _id: null,
          totalQueries: { $sum: 1 },
          avgExecutionTime: { $avg: '$millis' },
          maxExecutionTime: { $max: '$millis' },
          avgKeysExamined: { $avg: '$keysExamined' },
          avgDocsExamined: { $avg: '$docsExamined' },
          avgDocsReturned: { $avg: '$docsReturned' },
          slowQueries: {
            $sum: { $cond: [{ $gt: ['$millis', 100] }, 1, 0] }
          }
        }
      }
    ]).toArray();

    const before = beforeStats[0] || {
      totalQueries: 0,
      avgExecutionTime: 0,
      maxExecutionTime: 0,
      avgKeysExamined: 0,
      avgDocsExamined: 0,
      avgDocsReturned: 0,
      slowQueries: 0
    };

    const after = afterStats[0] || {
      totalQueries: 0,
      avgExecutionTime: 0,
      maxExecutionTime: 0,
      avgKeysExamined: 0,
      avgDocsExamined: 0,
      avgDocsReturned: 0,
      slowQueries: 0
    };

    // Calculate improvements
    const calculateImprovement = (beforeVal, afterVal) => {
      if (beforeVal === 0) return afterVal === 0 ? 0 : 100;
      return Math.round(((beforeVal - afterVal) / beforeVal) * 100);
    };

    const comparison = {
      before: {
        totalQueries: before.totalQueries,
        avgExecutionTime: Math.round(before.avgExecutionTime || 0),
        maxExecutionTime: before.maxExecutionTime || 0,
        avgKeysExamined: Math.round(before.avgKeysExamined || 0),
        avgDocsExamined: Math.round(before.avgDocsExamined || 0),
        avgDocsReturned: Math.round(before.avgDocsReturned || 0),
        slowQueries: before.slowQueries,
        efficiency: before.avgDocsExamined > 0 ? 
          Math.round((before.avgDocsReturned / before.avgDocsExamined) * 100) : 100
      },
      after: {
        totalQueries: after.totalQueries,
        avgExecutionTime: Math.round(after.avgExecutionTime || 0),
        maxExecutionTime: after.maxExecutionTime || 0,
        avgKeysExamined: Math.round(after.avgKeysExamined || 0),
        avgDocsExamined: Math.round(after.avgDocsExamined || 0),
        avgDocsReturned: Math.round(after.avgDocsReturned || 0),
        slowQueries: after.slowQueries,
        efficiency: after.avgDocsExamined > 0 ? 
          Math.round((after.avgDocsReturned / after.avgDocsExamined) * 100) : 100
      },
      improvements: {
        avgExecutionTime: calculateImprovement(before.avgExecutionTime, after.avgExecutionTime),
        maxExecutionTime: calculateImprovement(before.maxExecutionTime, after.maxExecutionTime),
        avgKeysExamined: calculateImprovement(before.avgKeysExamined, after.avgKeysExamined),
        avgDocsExamined: calculateImprovement(before.avgDocsExamined, after.avgDocsExamined),
        slowQueries: calculateImprovement(before.slowQueries, after.slowQueries),
        efficiency: Math.round(((after.avgDocsReturned / Math.max(after.avgDocsExamined, 1)) - 
                               (before.avgDocsReturned / Math.max(before.avgDocsExamined, 1))) * 100)
      }
    };

    res.json({
      success: true,
      data: comparison,
      periods: {
        before: { from: beforeFrom, to: beforeTo },
        after: { from: afterFrom, to: afterTo }
      },
      collection: collection || 'all'
    });

  } catch (error) {
    console.error('Period comparison error:', error);
    res.status(500).json({
      error: 'Failed to compare periods',
      message: error.message
    });
  }
});

export default router;