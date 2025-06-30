import React, { useState, useEffect } from 'react';
import { Database, Activity, Search, BarChart3, Settings, Eye, AlertTriangle, Layers } from 'lucide-react';
import ProfilerTable from './components/ProfilerTable';
import IndexManager from './components/IndexManager';
import AnalyticsDashboard from './components/AnalyticsDashboard';

interface ProfilerData {
  queryId: string;
  queryText: string;
  executionTime: number;
  keysExamined: number;
  docsExamined: number;
  docsReturned: number;
  ts: string;
  namespace: string;
  operation: string;
  planSummary?: string;
}

interface ExplainPlan {
  queryId: string;
  namespace: string;
  operation: string;
  originalQuery: any;
  explainPlan: {
    performance: {
      executionTimeMillis: number;
      totalKeysExamined: number;
      totalDocsExamined: number;
      totalDocsReturned: number;
      indexesUsed: string[];
      isCollectionScan: boolean;
      efficiency: number;
    };
    recommendations: Array<{
      type: string;
      priority: string;
      message: string;
      reason: string;
      suggestedIndex?: any;
    }>;
    stages: Array<{
      stage: string;
      depth: number;
      executionTimeMillisEstimate: number;
      indexName?: string;
      docsExamined: number;
      keysExamined: number;
    }>;
  } | null;
  profilerData: {
    timestamp: string;
    executionTime: number;
    planSummary?: string;
  };
}

interface ApiResponse {
  success: boolean;
  data: ProfilerData[];
  total: number;
}

function App() {
  const [profilerData, setProfilerData] = useState<ProfilerData[]>([]);
  const [selectedExplain, setSelectedExplain] = useState<ExplainPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('profiler');

  // Check backend connection
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('http://localhost:3001/health');
      if (response.ok) {
        setConnected(true);
      }
    } catch (error) {
      console.log('Backend not connected');
      setConnected(false);
    }
  };

  const loadProfilerData = async () => {
    setLoading(true);
    try {
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Last 24 hours
      const to = new Date().toISOString();
      
      const response = await fetch(
        `http://localhost:3001/api/profiler?from=${from}&to=${to}&limit=50`
      );
      
      if (response.ok) {
        const result: ApiResponse = await response.json();
        setProfilerData(result.data);
      }
    } catch (error) {
      console.error('Failed to load profiler data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExplainPlan = async (queryId: string) => {
    setExplainLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/profiler/explain?queryId=${queryId}`);
      const result = await response.json();
      
      if (result.success || result.data) {
        setSelectedExplain(result.data);
        setActiveTab('explain');
      } else {
        console.error('Failed to load explain plan:', result.message);
      }
    } catch (error) {
      console.error('Failed to load explain plan:', error);
    } finally {
      setExplainLoading(false);
    }
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getPerformanceColor = (ms: number) => {
    if (ms < 10) return 'text-green-600';
    if (ms < 100) return 'text-yellow-600';
    if (ms < 1000) return 'text-orange-600';
    return 'text-red-600';
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 80) return 'text-green-600';
    if (efficiency >= 50) return 'text-yellow-600';
    if (efficiency >= 20) return 'text-orange-600';
    return 'text-red-600';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Database className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Studio3T Profiler</h1>
                <p className="text-sm text-gray-500">MongoDB Performance Analysis</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>{connected ? 'Connected' : 'Disconnected'}</span>
              </div>
              
              <button
                onClick={checkConnection}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh connection"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'profiler', label: 'Query Profiler', icon: Activity },
              { id: 'explain', label: 'Explain Plan', icon: Eye },
              { id: 'indexes', label: 'Index Manager', icon: Layers },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'search', label: 'Query Search', icon: Search }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'profiler' && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Query Profiler</h2>
                <button
                  onClick={loadProfilerData}
                  disabled={!connected || loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  <Activity className="h-4 w-4" />
                  <span>{loading ? 'Loading...' : 'Load Profiler Data'}</span>
                </button>
              </div>
              
              {!connected && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-yellow-400 rounded-full" />
                    <p className="text-yellow-800 text-sm">
                      Backend server not connected. Please start the backend server with: <code className="bg-yellow-100 px-2 py-1 rounded">npm run dev:backend</code>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Profiler Data Table */}
            <ProfilerTable
              data={profilerData}
              loading={loading}
              connected={connected}
              onExplainClick={loadExplainPlan}
              explainLoading={explainLoading}
            />
          </div>
        )}

        {activeTab === 'explain' && (
          <div className="space-y-6">
            {selectedExplain ? (
              <>
                {/* Explain Plan Header */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Explain Plan Analysis</h2>
                      <p className="text-sm text-gray-500">Query ID: {selectedExplain.queryId}</p>
                    </div>
                    <button
                      onClick={() => setSelectedExplain(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <span className="sr-only">Close</span>
                      ✕
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm font-medium text-gray-500">Namespace</div>
                      <div className="text-lg font-semibold text-gray-900">{selectedExplain.namespace}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm font-medium text-gray-500">Operation</div>
                      <div className="text-lg font-semibold text-gray-900">{selectedExplain.operation}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm font-medium text-gray-500">Execution Time</div>
                      <div className={`text-lg font-semibold ${getPerformanceColor(selectedExplain.profilerData.executionTime)}`}>
                        {formatExecutionTime(selectedExplain.profilerData.executionTime)}
                      </div>
                    </div>
                  </div>
                </div>

                {selectedExplain.explainPlan ? (
                  <>
                    {/* Performance Metrics */}
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">
                            {selectedExplain.explainPlan.performance.totalDocsExamined.toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">Docs Examined</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">
                            {selectedExplain.explainPlan.performance.totalKeysExamined.toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">Keys Examined</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">
                            {selectedExplain.explainPlan.performance.totalDocsReturned.toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">Docs Returned</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${getEfficiencyColor(selectedExplain.explainPlan.performance.efficiency)}`}>
                            {selectedExplain.explainPlan.performance.efficiency}%
                          </div>
                          <div className="text-sm text-gray-500">Efficiency</div>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {selectedExplain.explainPlan.performance.isCollectionScan ? (
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          )}
                          <span className="text-sm text-gray-700">
                            {selectedExplain.explainPlan.performance.isCollectionScan ? 'Collection Scan' : 'Index Used'}
                          </span>
                        </div>
                        
                        {selectedExplain.explainPlan.performance.indexesUsed.length > 0 && (
                          <div className="flex items-center space-x-2">
                            <div className="h-4 w-4 text-blue-500">⚡</div>
                            <span className="text-sm text-gray-700">
                              Indexes: {selectedExplain.explainPlan.performance.indexesUsed.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recommendations */}
                    {selectedExplain.explainPlan.recommendations.length > 0 && (
                      <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Optimization Recommendations</h3>
                        <div className="space-y-3">
                          {selectedExplain.explainPlan.recommendations.map((rec, index) => (
                            <div key={index} className={`border rounded-lg p-4 ${getPriorityColor(rec.priority)}`}>
                              <div className="flex items-start space-x-3">
                                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="font-medium">{rec.message}</div>
                                  <div className="text-sm mt-1">{rec.reason}</div>
                                  {rec.suggestedIndex && (
                                    <div className="mt-2">
                                      <code className="bg-white bg-opacity-50 px-2 py-1 rounded text-xs">
                                        {JSON.stringify(rec.suggestedIndex)}
                                      </code>
                                    </div>
                                  )}
                                </div>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white bg-opacity-50">
                                  {rec.priority}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Execution Stages */}
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Execution Stages</h3>
                      <div className="space-y-2">
                        {selectedExplain.explainPlan.stages.map((stage, index) => (
                          <div key={index} className="flex items-center space-x-4 py-2 border-b border-gray-100 last:border-b-0">
                            <div className="flex-shrink-0" style={{ marginLeft: `${stage.depth * 20}px` }}>
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{stage.stage}</div>
                              {stage.indexName && (
                                <div className="text-sm text-gray-500">Index: {stage.indexName}</div>
                              )}
                            </div>
                            <div className="text-right text-sm text-gray-500">
                              <div>Docs: {stage.docsExamined.toLocaleString()}</div>
                              <div>Keys: {stage.keysExamined.toLocaleString()}</div>
                            </div>
                            <div className="text-right text-sm text-gray-500">
                              {formatExecutionTime(stage.executionTimeMillisEstimate)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-center py-8">
                      <AlertTriangle className="mx-auto h-12 w-12 text-yellow-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">Explain Plan Unavailable</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Could not generate explain plan for this query. The query may be from a different database or collection that is no longer accessible.
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center py-12">
                  <Eye className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No Explain Plan Selected</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Go to the Query Profiler tab and click "Explain" on any query to view its execution plan.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'indexes' && <IndexManager />}

        {activeTab === 'analytics' && <AnalyticsDashboard />}

        {activeTab === 'search' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-12">
              <Search className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Query Search</h3>
              <p className="mt-1 text-sm text-gray-500">
                Coming soon - Advanced query filtering and search capabilities.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;