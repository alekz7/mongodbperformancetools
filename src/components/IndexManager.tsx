import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Plus, 
  Trash2, 
  Search, 
  BarChart3, 
  AlertTriangle, 
  CheckCircle, 
  Zap,
  HardDrive,
  Clock,
  TrendingUp,
  Filter,
  RefreshCw
} from 'lucide-react';

interface IndexData {
  name: string;
  key: Record<string, any>;
  collection: string;
  database: string;
  size: number;
  usage: {
    ops: number;
    since: string;
  };
  unique?: boolean;
  sparse?: boolean;
  background?: boolean;
  partialFilterExpression?: any;
}

interface IndexStats {
  totalIndexes: number;
  totalSize: number;
  collectionsWithIndexes: number;
  unusedIndexes: number;
}

interface IndexRecommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  count: number;
  message: string;
  description: string;
  indexes?: Array<{
    name: string;
    collection: string;
    size: number;
  }>;
  collections?: string[];
}

interface CreateIndexForm {
  collection: string;
  indexName: string;
  fields: Array<{
    field: string;
    direction: 1 | -1 | 'text' | '2dsphere' | 'hashed';
  }>;
  options: {
    unique: boolean;
    sparse: boolean;
    background: boolean;
    partialFilterExpression: string;
  };
}

const IndexManager: React.FC = () => {
  const [indexes, setIndexes] = useState<IndexData[]>([]);
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [recommendations, setRecommendations] = useState<IndexRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [collections, setCollections] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateIndexForm>({
    collection: '',
    indexName: '',
    fields: [{ field: '', direction: 1 }],
    options: {
      unique: false,
      sparse: false,
      background: true,
      partialFilterExpression: ''
    }
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadIndexes();
    loadStats();
  }, [selectedCollection]);

  const loadIndexes = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/indexes?collection=${selectedCollection}`
      );
      
      if (response.ok) {
        const result = await response.json();
        setIndexes(result.data);
        setStats(result.stats);
        
        // Extract unique collections
        const uniqueCollections = [...new Set(result.data.map((idx: IndexData) => idx.collection))];
        setCollections(uniqueCollections);
      }
    } catch (error) {
      console.error('Failed to load indexes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/indexes/stats');
      if (response.ok) {
        const result = await response.json();
        setRecommendations(result.data.recommendations || []);
      }
    } catch (error) {
      console.error('Failed to load index stats:', error);
    }
  };

  const createIndex = async () => {
    try {
      const indexSpec = createForm.fields.reduce((spec, field) => {
        if (field.field) {
          spec[field.field] = field.direction;
        }
        return spec;
      }, {} as Record<string, any>);

      const options: any = {
        background: createForm.options.background,
        unique: createForm.options.unique,
        sparse: createForm.options.sparse
      };

      if (createForm.indexName) {
        options.name = createForm.indexName;
      }

      if (createForm.options.partialFilterExpression) {
        try {
          options.partialFilterExpression = JSON.parse(createForm.options.partialFilterExpression);
        } catch (e) {
          alert('Invalid partial filter expression JSON');
          return;
        }
      }

      const response = await fetch('http://localhost:3001/api/indexes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: createForm.collection,
          indexSpec,
          options
        })
      });

      if (response.ok) {
        setShowCreateForm(false);
        resetCreateForm();
        loadIndexes();
      } else {
        const error = await response.json();
        alert(`Failed to create index: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to create index:', error);
      alert('Failed to create index');
    }
  };

  const dropIndex = async (collection: string, indexName: string) => {
    if (indexName === '_id_') {
      alert('Cannot drop the default _id index');
      return;
    }

    if (!confirm(`Are you sure you want to drop index "${indexName}" from collection "${collection}"?`)) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:3001/api/indexes?collection=${collection}&indexName=${indexName}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        loadIndexes();
      } else {
        const error = await response.json();
        alert(`Failed to drop index: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to drop index:', error);
      alert('Failed to drop index');
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      collection: '',
      indexName: '',
      fields: [{ field: '', direction: 1 }],
      options: {
        unique: false,
        sparse: false,
        background: true,
        partialFilterExpression: ''
      }
    });
  };

  const addField = () => {
    setCreateForm(prev => ({
      ...prev,
      fields: [...prev.fields, { field: '', direction: 1 }]
    }));
  };

  const removeField = (index: number) => {
    setCreateForm(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index)
    }));
  };

  const updateField = (index: number, field: string, direction: any) => {
    setCreateForm(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => 
        i === index ? { field, direction } : f
      )
    }));
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getIndexTypeIcon = (key: Record<string, any>) => {
    const values = Object.values(key);
    if (values.includes('text')) return '📝';
    if (values.includes('2dsphere')) return '🌍';
    if (values.includes('hashed')) return '#️⃣';
    if (Object.keys(key).length > 1) return '🔗';
    return '📊';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const filteredIndexes = indexes.filter(index => 
    index.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    index.collection.toLowerCase().includes(searchTerm.toLowerCase()) ||
    JSON.stringify(index.key).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Index Manager</h2>
            <p className="text-gray-600">Manage MongoDB indexes for optimal query performance</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadIndexes}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Index
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center">
                <Database className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-600">Total Indexes</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalIndexes}</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center">
                <HardDrive className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-600">Total Size</p>
                  <p className="text-2xl font-bold text-green-900">{formatSize(stats.totalSize)}</p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-600">Collections</p>
                  <p className="text-2xl font-bold text-purple-900">{stats.collectionsWithIndexes}</p>
                </div>
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-orange-600">Unused</p>
                  <p className="text-2xl font-bold text-orange-900">{stats.unusedIndexes}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search indexes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Collections</option>
              {collections.map(collection => (
                <option key={collection} value={collection}>{collection}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimization Recommendations</h3>
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div key={index} className={`border rounded-lg p-4 ${getPriorityColor(rec.priority)}`}>
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium">{rec.message}</div>
                    <div className="text-sm mt-1">{rec.description}</div>
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

      {/* Index Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Indexes {filteredIndexes.length > 0 && `(${filteredIndexes.length})`}
          </h3>
        </div>
        
        {loading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex space-x-4">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                  <div className="h-4 bg-gray-200 rounded flex-1"></div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredIndexes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Index
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Collection
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Keys
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Properties
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredIndexes.map((index, idx) => (
                  <tr key={`${index.collection}-${index.name}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{getIndexTypeIcon(index.key)}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{index.name}</div>
                          {index.name === '_id_' && (
                            <div className="text-xs text-gray-500">Default Index</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {index.collection}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {JSON.stringify(index.key)}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatSize(index.size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {index.usage.ops > 0 ? (
                          <div className="flex items-center space-x-1 text-green-600">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-sm font-medium">{index.usage.ops.toLocaleString()}</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1 text-gray-400">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">Unused</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-1">
                        {index.unique && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Unique
                          </span>
                        )}
                        {index.sparse && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Sparse
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {index.name !== '_id_' && (
                        <button
                          onClick={() => dropIndex(index.collection, index.name)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Drop
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Database className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No indexes found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'No indexes match your search criteria.' : 'No indexes available for the selected collection.'}
            </p>
          </div>
        )}
      </div>

      {/* Create Index Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create New Index</h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Collection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Collection *
                  </label>
                  <select
                    value={createForm.collection}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, collection: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select collection...</option>
                    {collections.map(collection => (
                      <option key={collection} value={collection}>{collection}</option>
                    ))}
                  </select>
                </div>

                {/* Index Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Index Name (optional)
                  </label>
                  <input
                    type="text"
                    value={createForm.indexName}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, indexName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Leave empty for auto-generated name"
                  />
                </div>

                {/* Fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Index Fields *
                  </label>
                  {createForm.fields.map((field, index) => (
                    <div key={index} className="flex items-center space-x-2 mb-2">
                      <input
                        type="text"
                        value={field.field}
                        onChange={(e) => updateField(index, e.target.value, field.direction)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Field name"
                        required
                      />
                      <select
                        value={field.direction}
                        onChange={(e) => updateField(index, field.field, e.target.value === '1' ? 1 : e.target.value === '-1' ? -1 : e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value={1}>Ascending (1)</option>
                        <option value={-1}>Descending (-1)</option>
                        <option value="text">Text</option>
                        <option value="2dsphere">2D Sphere</option>
                        <option value="hashed">Hashed</option>
                      </select>
                      {createForm.fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeField(index)}
                          className="p-2 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addField}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Field
                  </button>
                </div>

                {/* Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={createForm.options.unique}
                        onChange={(e) => setCreateForm(prev => ({
                          ...prev,
                          options: { ...prev.options, unique: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Unique</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={createForm.options.sparse}
                        onChange={(e) => setCreateForm(prev => ({
                          ...prev,
                          options: { ...prev.options, sparse: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Sparse</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={createForm.options.background}
                        onChange={(e) => setCreateForm(prev => ({
                          ...prev,
                          options: { ...prev.options, background: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Background (recommended)</span>
                    </label>
                  </div>
                </div>

                {/* Partial Filter Expression */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Partial Filter Expression (JSON)
                  </label>
                  <textarea
                    value={createForm.options.partialFilterExpression}
                    onChange={(e) => setCreateForm(prev => ({
                      ...prev,
                      options: { ...prev.options, partialFilterExpression: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder='{"field": {"$gt": 0}}'
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createIndex}
                  disabled={!createForm.collection || createForm.fields.some(f => !f.field)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Index
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndexManager;