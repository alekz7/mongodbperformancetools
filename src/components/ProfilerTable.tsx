import React from 'react';
import { Clock, Eye } from 'lucide-react';

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

interface ProfilerTableProps {
  data: ProfilerData[];
  loading: boolean;
  connected: boolean;
  onExplainClick: (queryId: string) => void;
  explainLoading: boolean;
}

const ProfilerTable: React.FC<ProfilerTableProps> = ({
  data,
  loading,
  connected,
  onExplainClick,
  explainLoading
}) => {
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

  const getOperationColor = (operation: string) => {
    switch (operation.toLowerCase()) {
      case 'find':
      case 'query':
        return 'bg-blue-100 text-blue-800';
      case 'insert':
        return 'bg-green-100 text-green-800';
      case 'update':
        return 'bg-yellow-100 text-yellow-800';
      case 'delete':
      case 'remove':
        return 'bg-red-100 text-red-800';
      case 'aggregate':
        return 'bg-purple-100 text-purple-800';
      case 'count':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEfficiencyIndicator = (query: ProfilerData) => {
    const examined = query.docsExamined || 0;
    const returned = query.docsReturned || 0;
    
    if (examined === 0) return { efficiency: 100, color: 'text-green-600' };
    if (returned === 0) return { efficiency: 0, color: 'text-red-600' };
    
    const efficiency = Math.round((returned / examined) * 100);
    
    let color = 'text-red-600';
    if (efficiency >= 80) color = 'text-green-600';
    else if (efficiency >= 50) color = 'text-yellow-600';
    else if (efficiency >= 20) color = 'text-orange-600';
    
    return { efficiency, color };
  };

  const truncateQuery = (queryText: string, maxLength: number = 100) => {
    if (queryText.length <= maxLength) return queryText;
    return queryText.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Loading Profiler Data...</h3>
        </div>
        <div className="p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                <div className="h-4 bg-gray-200 rounded flex-1"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            Recent Queries {data.length > 0 && `(${data.length})`}
          </h3>
          {data.length > 0 && (
            <div className="text-sm text-gray-500">
              Showing {data.length} most recent queries
            </div>
          )}
        </div>
      </div>
      
      {data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Namespace
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Operation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Efficiency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Documents
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Query
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((query, index) => {
                const efficiency = getEfficiencyIndicator(query);
                return (
                  <tr key={query.queryId || index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <div className="font-medium">
                            {new Date(query.ts).toLocaleTimeString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(query.ts).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs">
                        <div className="font-medium truncate">{query.namespace}</div>
                        {query.planSummary && (
                          <div className="text-xs text-gray-500 truncate">
                            {query.planSummary}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOperationColor(query.operation)}`}>
                        {query.operation.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className={`font-bold ${getPerformanceColor(query.executionTime)}`}>
                          {formatExecutionTime(query.executionTime)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Keys: {query.keysExamined.toLocaleString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className={`text-sm font-medium ${efficiency.color}`}>
                          {efficiency.efficiency}%
                        </div>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              efficiency.efficiency >= 80 ? 'bg-green-500' :
                              efficiency.efficiency >= 50 ? 'bg-yellow-500' :
                              efficiency.efficiency >= 20 ? 'bg-orange-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.max(efficiency.efficiency, 5)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Examined:</span>
                          <span className="font-medium">{(query.docsExamined || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Returned:</span>
                          <span className="font-medium">{(query.docsReturned || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-sm">
                        <details className="group">
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-center justify-between">
                              <code className="bg-gray-100 px-2 py-1 rounded text-xs truncate max-w-xs">
                                {truncateQuery(query.queryText)}
                              </code>
                              <span className="ml-2 text-xs text-gray-400 group-open:rotate-180 transition-transform">
                                ▼
                              </span>
                            </div>
                          </summary>
                          <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                              {query.queryText}
                            </pre>
                          </div>
                        </details>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => onExplainClick(query.queryId)}
                        disabled={explainLoading}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {explainLoading ? 'Loading...' : 'Explain'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="mx-auto h-24 w-24 text-gray-300 mb-4">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No profiler data available</h3>
          <p className="text-gray-500 mb-6">
            {connected 
              ? 'Click "Load Profiler Data" to fetch recent queries from your MongoDB instance.' 
              : 'Connect to the backend server to view profiler data.'
            }
          </p>
          {!connected && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-yellow-800 text-sm">
                Start the backend server: <code className="bg-yellow-100 px-2 py-1 rounded font-mono">npm run dev:backend</code>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfilerTable;