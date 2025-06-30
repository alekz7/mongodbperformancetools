import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { format, subHours, subDays } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Database,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Calendar,
  Filter
} from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale
);

interface PerformanceTrend {
  timestamp: string;
  avgExecutionTime: number;
  maxExecutionTime: number;
  totalQueries: number;
  avgKeysExamined: number;
  avgDocsExamined: number;
  slowQueries: number;
  efficiency: number;
}

interface OperationBreakdown {
  operation: string;
  count: number;
  avgExecutionTime: number;
  totalExecutionTime: number;
  percentage: number;
}

interface CollectionPerformance {
  collection: string;
  totalQueries: number;
  avgExecutionTime: number;
  maxExecutionTime: number;
  efficiency: number;
  slowQueryPercentage: number;
}

interface ComparisonData {
  before: {
    avgExecutionTime: number;
    maxExecutionTime: number;
    avgKeysExamined: number;
    slowQueries: number;
    efficiency: number;
  };
  after: {
    avgExecutionTime: number;
    maxExecutionTime: number;
    avgKeysExamined: number;
    slowQueries: number;
    efficiency: number;
  };
  improvements: {
    avgExecutionTime: number;
    maxExecutionTime: number;
    avgKeysExamined: number;
    slowQueries: number;
    efficiency: number;
  };
}

const AnalyticsDashboard: React.FC = () => {
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrend[]>([]);
  const [operationBreakdown, setOperationBreakdown] = useState<OperationBreakdown[]>([]);
  const [collectionPerformance, setCollectionPerformance] = useState<CollectionPerformance[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedCollection, setSelectedCollection] = useState('all');
  const [collections, setCollections] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange, selectedCollection]);

  const getTimeRange = () => {
    const now = new Date();
    switch (timeRange) {
      case '1h':
        return { from: subHours(now, 1), to: now, interval: 'minute' };
      case '6h':
        return { from: subHours(now, 6), to: now, interval: 'minute' };
      case '24h':
        return { from: subHours(now, 24), to: now, interval: 'hour' };
      case '7d':
        return { from: subDays(now, 7), to: now, interval: 'hour' };
      case '30d':
        return { from: subDays(now, 30), to: now, interval: 'day' };
      default:
        return { from: subHours(now, 24), to: now, interval: 'hour' };
    }
  };

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const { from, to, interval } = getTimeRange();
      const fromStr = from.toISOString();
      const toStr = to.toISOString();

      // Load performance trends
      const trendsResponse = await fetch(
        `http://localhost:3001/api/analytics/performance-trends?from=${fromStr}&to=${toStr}&collection=${selectedCollection}&interval=${interval}`
      );
      if (trendsResponse.ok) {
        const trendsResult = await trendsResponse.json();
        setPerformanceTrends(trendsResult.data);
      }

      // Load operation breakdown
      const operationsResponse = await fetch(
        `http://localhost:3001/api/analytics/operation-breakdown?from=${fromStr}&to=${toStr}&collection=${selectedCollection}`
      );
      if (operationsResponse.ok) {
        const operationsResult = await operationsResponse.json();
        const total = operationsResult.data.reduce((sum: number, op: OperationBreakdown) => sum + op.count, 0);
        const withPercentages = operationsResult.data.map((op: OperationBreakdown) => ({
          ...op,
          percentage: total > 0 ? Math.round((op.count / total) * 100) : 0
        }));
        setOperationBreakdown(withPercentages);
      }

      // Load collection performance
      const collectionsResponse = await fetch(
        `http://localhost:3001/api/analytics/collection-performance?from=${fromStr}&to=${toStr}`
      );
      if (collectionsResponse.ok) {
        const collectionsResult = await collectionsResponse.json();
        setCollectionPerformance(collectionsResult.data);
        
        // Extract unique collections for filter
        const uniqueCollections = collectionsResult.data.map((c: CollectionPerformance) => c.collection);
        setCollections(uniqueCollections);
      }

    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadComparison = async () => {
    try {
      const now = new Date();
      const { from: afterFrom, to: afterTo } = getTimeRange();
      
      // Compare with previous period of same duration
      const duration = afterTo.getTime() - afterFrom.getTime();
      const beforeTo = new Date(afterFrom.getTime());
      const beforeFrom = new Date(afterFrom.getTime() - duration);

      const response = await fetch('http://localhost:3001/api/analytics/compare-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beforePeriod: {
            from: beforeFrom.toISOString(),
            to: beforeTo.toISOString()
          },
          afterPeriod: {
            from: afterFrom.toISOString(),
            to: afterTo.toISOString()
          },
          collection: selectedCollection
        })
      });

      if (response.ok) {
        const result = await response.json();
        setComparisonData(result.data);
        setShowComparison(true);
      }
    } catch (error) {
      console.error('Failed to load comparison data:', error);
    }
  };

  // Chart configurations
  const performanceChartData = {
    labels: performanceTrends.map(trend => 
      format(new Date(trend.timestamp), timeRange === '1h' || timeRange === '6h' ? 'HH:mm' : 
             timeRange === '24h' ? 'HH:mm' : 'MM/dd')
    ),
    datasets: [
      {
        label: 'Avg Execution Time (ms)',
        data: performanceTrends.map(trend => trend.avgExecutionTime),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        yAxisID: 'y'
      },
      {
        label: 'Query Count',
        data: performanceTrends.map(trend => trend.totalQueries),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        yAxisID: 'y1'
      }
    ]
  };

  const performanceChartOptions = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: 'Performance Trends Over Time'
      },
      legend: {
        position: 'top' as const,
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time'
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Execution Time (ms)'
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Query Count'
        },
        grid: {
          drawOnChartArea: false,
        },
      }
    }
  };

  const operationChartData = {
    labels: operationBreakdown.map(op => op.operation.toUpperCase()),
    datasets: [
      {
        data: operationBreakdown.map(op => op.count),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)'
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(245, 158, 11)',
          'rgb(239, 68, 68)',
          'rgb(139, 92, 246)',
          'rgb(236, 72, 153)'
        ],
        borderWidth: 2
      }
    ]
  };

  const collectionChartData = {
    labels: collectionPerformance.slice(0, 10).map(c => c.collection),
    datasets: [
      {
        label: 'Avg Execution Time (ms)',
        data: collectionPerformance.slice(0, 10).map(c => c.avgExecutionTime),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1
      },
      {
        label: 'Efficiency (%)',
        data: collectionPerformance.slice(0, 10).map(c => c.efficiency),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
        yAxisID: 'y1'
      }
    ]
  };

  const collectionChartOptions = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Collection Performance Comparison'
      },
      legend: {
        position: 'top' as const,
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Collections'
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Execution Time (ms)'
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Efficiency (%)'
        },
        min: 0,
        max: 100,
        grid: {
          drawOnChartArea: false,
        },
      }
    }
  };

  const getImprovementColor = (improvement: number) => {
    if (improvement > 0) return 'text-green-600';
    if (improvement < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getImprovementIcon = (improvement: number) => {
    if (improvement > 0) return <TrendingUp className="h-4 w-4" />;
    if (improvement < 0) return <TrendingDown className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Performance Analytics</h2>
            <p className="text-gray-600">Monitor query performance trends and identify optimization opportunities</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadComparison}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Compare Periods
            </button>
            <button
              onClick={loadAnalyticsData}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="1h">Last Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Collections</option>
              {collections.map(collection => (
                <option key={collection} value={collection}>{collection}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Performance Comparison Modal */}
      {showComparison && comparisonData && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Performance Comparison</h3>
              <button
                onClick={() => setShowComparison(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Before Period */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Before Period</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Execution Time:</span>
                    <span className="font-medium">{comparisonData.before.avgExecutionTime}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Max Execution Time:</span>
                    <span className="font-medium">{comparisonData.before.maxExecutionTime}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Keys Examined:</span>
                    <span className="font-medium">{comparisonData.before.avgKeysExamined}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Slow Queries:</span>
                    <span className="font-medium">{comparisonData.before.slowQueries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Efficiency:</span>
                    <span className="font-medium">{comparisonData.before.efficiency}%</span>
                  </div>
                </div>
              </div>

              {/* After Period */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">After Period</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Execution Time:</span>
                    <span className="font-medium">{comparisonData.after.avgExecutionTime}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Max Execution Time:</span>
                    <span className="font-medium">{comparisonData.after.maxExecutionTime}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Keys Examined:</span>
                    <span className="font-medium">{comparisonData.after.avgKeysExamined}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Slow Queries:</span>
                    <span className="font-medium">{comparisonData.after.slowQueries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Efficiency:</span>
                    <span className="font-medium">{comparisonData.after.efficiency}%</span>
                  </div>
                </div>
              </div>

              {/* Improvements */}
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Improvements</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Execution Time:</span>
                    <div className={`flex items-center space-x-1 font-medium ${getImprovementColor(comparisonData.improvements.avgExecutionTime)}`}>
                      {getImprovementIcon(comparisonData.improvements.avgExecutionTime)}
                      <span>{Math.abs(comparisonData.improvements.avgExecutionTime)}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Max Execution:</span>
                    <div className={`flex items-center space-x-1 font-medium ${getImprovementColor(comparisonData.improvements.maxExecutionTime)}`}>
                      {getImprovementIcon(comparisonData.improvements.maxExecutionTime)}
                      <span>{Math.abs(comparisonData.improvements.maxExecutionTime)}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Keys Examined:</span>
                    <div className={`flex items-center space-x-1 font-medium ${getImprovementColor(comparisonData.improvements.avgKeysExamined)}`}>
                      {getImprovementIcon(comparisonData.improvements.avgKeysExamined)}
                      <span>{Math.abs(comparisonData.improvements.avgKeysExamined)}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Slow Queries:</span>
                    <div className={`flex items-center space-x-1 font-medium ${getImprovementColor(comparisonData.improvements.slowQueries)}`}>
                      {getImprovementIcon(comparisonData.improvements.slowQueries)}
                      <span>{Math.abs(comparisonData.improvements.slowQueries)}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Efficiency:</span>
                    <div className={`flex items-center space-x-1 font-medium ${getImprovementColor(comparisonData.improvements.efficiency)}`}>
                      {getImprovementIcon(comparisonData.improvements.efficiency)}
                      <span>{Math.abs(comparisonData.improvements.efficiency)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Trends */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Performance Trends</h3>
            <Activity className="h-5 w-5 text-blue-600" />
          </div>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : performanceTrends.length > 0 ? (
            <div className="h-64">
              <Line data={performanceChartData} options={performanceChartOptions} />
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No performance data available
            </div>
          )}
        </div>

        {/* Operation Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Operation Types</h3>
            <PieChart className="h-5 w-5 text-green-600" />
          </div>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : operationBreakdown.length > 0 ? (
            <div className="h-64">
              <Doughnut 
                data={operationChartData} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom'
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No operation data available
            </div>
          )}
        </div>
      </div>

      {/* Collection Performance */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Collection Performance</h3>
          <Database className="h-5 w-5 text-purple-600" />
        </div>
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : collectionPerformance.length > 0 ? (
          <div className="h-64">
            <Bar data={collectionChartData} options={collectionChartOptions} />
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No collection data available
          </div>
        )}
      </div>

      {/* Performance Summary Cards */}
      {performanceTrends.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-600">Avg Response Time</p>
                <p className="text-2xl font-bold text-blue-900">
                  {Math.round(performanceTrends.reduce((sum, t) => sum + t.avgExecutionTime, 0) / performanceTrends.length)}ms
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-600">Total Queries</p>
                <p className="text-2xl font-bold text-green-900">
                  {performanceTrends.reduce((sum, t) => sum + t.totalQueries, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-orange-600">Slow Queries</p>
                <p className="text-2xl font-bold text-orange-900">
                  {performanceTrends.reduce((sum, t) => sum + t.slowQueries, 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Zap className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-600">Avg Efficiency</p>
                <p className="text-2xl font-bold text-purple-900">
                  {Math.round(performanceTrends.reduce((sum, t) => sum + t.efficiency, 0) / performanceTrends.length)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;