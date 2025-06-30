/**
 * Studio3T Profiler Schema Definitions
 * 
 * This file defines the expected structure for MongoDB profiler data
 * and provides utilities for data validation and transformation.
 */

export const ProfilerDataSchema = {
  // Core fields expected in system.profile collection
  ts: 'Date',              // Timestamp of the operation
  op: 'String',            // Operation type (query, insert, update, delete, etc.)
  ns: 'String',            // Namespace (database.collection)
  command: 'Object',       // The actual command/query executed
  millis: 'Number',        // Execution time in milliseconds
  keysExamined: 'Number',  // Number of index keys examined
  docsExamined: 'Number',  // Number of documents examined
  keysReturned: 'Number',  // Number of keys returned
  docsReturned: 'Number',  // Number of documents returned
  
  // Optional execution statistics
  executionStats: {
    stage: 'String',
    executionTimeMillisEstimate: 'Number',
    inputStage: 'Object'
  },
  
  // Connection info
  client: 'String',
  user: 'String',
  
  // Lock information
  locks: 'Object',
  
  // Protocol information
  protocol: 'String'
};

/**
 * Transform raw profiler data to Studio3T format
 */
export function transformProfilerData(rawData) {
  if (!rawData || !Array.isArray(rawData)) {
    return [];
  }

  return rawData.map(doc => ({
    queryText: formatQuery(doc.command || doc.query || {}),
    executionTime: doc.millis || doc.duration || 0,
    keysExamined: doc.keysExamined || doc.executionStats?.keysExamined || 0,
    docsExamined: doc.docsExamined || doc.executionStats?.docsExamined || 0,
    ts: doc.ts,
    namespace: doc.ns,
    operation: doc.op || 'unknown',
    client: doc.client || 'unknown',
    planSummary: doc.planSummary || null,
    
    // Performance indicators
    isSlowQuery: (doc.millis || 0) > 100,
    efficiency: calculateQueryEfficiency(doc),
    
    // Additional metadata
    lockAcquisitionTime: doc.lockStats?.acquireTime || null,
    storageEngine: doc.storage || null
  }));
}

/**
 * Format query command for display
 */
export function formatQuery(command) {
  if (!command || typeof command !== 'object') {
    return JSON.stringify(command || {});
  }

  try {
    // Pretty print with 2-space indentation
    return JSON.stringify(command, null, 2);
  } catch (error) {
    return String(command);
  }
}

/**
 * Calculate query efficiency based on examined vs returned ratios
 */
export function calculateQueryEfficiency(doc) {
  const keysExamined = doc.keysExamined || 0;
  const docsExamined = doc.docsExamined || 0;
  const docsReturned = doc.docsReturned || 0;
  
  if (docsExamined === 0) return 100; // Perfect efficiency if no docs examined
  if (docsReturned === 0) return 0;   // No efficiency if no results
  
  // Calculate efficiency as percentage of useful work
  const efficiency = (docsReturned / Math.max(docsExamined, keysExamined)) * 100;
  return Math.min(100, Math.max(0, efficiency));
}

/**
 * Validate profiler query parameters
 */
export function validateProfilerQuery(params) {
  const errors = [];
  const { from, to, collection, limit } = params;

  // Validate date parameters
  if (!from) {
    errors.push('Parameter "from" is required');
  } else if (isNaN(Date.parse(from))) {
    errors.push('Parameter "from" must be a valid date');
  }

  if (!to) {
    errors.push('Parameter "to" is required');
  } else if (isNaN(Date.parse(to))) {
    errors.push('Parameter "to" must be a valid date');
  }

  // Validate date range
  if (from && to && new Date(from) >= new Date(to)) {
    errors.push('Parameter "from" must be before "to"');
  }

  // Validate limit
  if (limit && (isNaN(parseInt(limit)) || parseInt(limit) <= 0)) {
    errors.push('Parameter "limit" must be a positive number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Default query parameters for profiler
 */
export const DEFAULT_PROFILER_PARAMS = {
  limit: 100,
  collection: 'all',
  sortBy: 'ts',
  sortOrder: -1
};

/**
 * Performance thresholds for categorizing queries
 */
export const PERFORMANCE_THRESHOLDS = {
  FAST: 10,      // < 10ms
  MODERATE: 100, // 10-100ms
  SLOW: 1000,    // 100ms-1s
  VERY_SLOW: 5000 // > 1s
};

/**
 * Categorize query performance
 */
export function categorizeQueryPerformance(executionTime) {
  if (executionTime < PERFORMANCE_THRESHOLDS.FAST) return 'fast';
  if (executionTime < PERFORMANCE_THRESHOLDS.MODERATE) return 'moderate';
  if (executionTime < PERFORMANCE_THRESHOLDS.SLOW) return 'slow';
  if (executionTime < PERFORMANCE_THRESHOLDS.VERY_SLOW) return 'very_slow';
  return 'critical';
}