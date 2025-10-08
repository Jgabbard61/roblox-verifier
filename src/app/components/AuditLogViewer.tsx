// FILE: src/app/components/AuditLogViewer.tsx
// Forensic Mode - Admin audit log viewer (role: admin only)

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface AuditLogEntry {
  id: string;
  reportId: string;
  createdBy: string;
  queryInput: string;
  queryMode: string;
  resultUserId?: string;
  snapshotHash: string;
  createdAt: string;
  exportedAt?: string;
  caseId?: string;
}

export default function AuditLogViewer() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    user: '',
    caseId: '',
    dateFrom: '',
    dateTo: '',
  });

  // Mock data for demonstration (replace with actual API call)
  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // TODO: Implement actual API call
      // const response = await fetch('/api/forensic/audit');
      // const data = await response.json();
      // setLogs(data);
      
      // Mock data for now
      setLogs([
        {
          id: '1',
          reportId: 'report-001',
          createdBy: session?.user?.email || 'analyst@example.com',
          queryInput: 'Roblox',
          queryMode: 'username',
          resultUserId: '1',
          snapshotHash: 'a1b2c3d4e5f6...',
          createdAt: new Date().toISOString(),
          caseId: 'CASE-2025-001',
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    }
    setLoading(false);
  };

  const applyFilters = () => {
    fetchLogs();
  };

  const exportLogs = () => {
    const csv = [
      ['Report ID', 'Created By', 'Query', 'Mode', 'User ID', 'Hash', 'Timestamp', 'Case ID'].join(','),
      ...logs.map(log =>
        [
          log.reportId,
          log.createdBy,
          log.queryInput,
          log.queryMode,
          log.resultUserId || '',
          log.snapshotHash.substring(0, 16) + '...',
          new Date(log.createdAt).toLocaleString(),
          log.caseId || '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Audit Logs</h2>
          <p className="text-sm text-gray-600">Forensic activity tracking and compliance</p>
        </div>
        <button
          onClick={exportLogs}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
        >
          📥 Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input
          type="text"
          placeholder="Filter by user..."
          value={filters.user}
          onChange={(e) => setFilters({ ...filters, user: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm"
        />
        <input
          type="text"
          placeholder="Filter by case ID..."
          value={filters.caseId}
          onChange={(e) => setFilters({ ...filters, caseId: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm"
        />
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm"
        />
        <button
          onClick={applyFilters}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm"
        >
          Apply Filters
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-600 font-medium">Total Reports</p>
          <p className="text-3xl font-bold text-blue-800">{logs.length}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-sm text-purple-600 font-medium">Today</p>
          <p className="text-3xl font-bold text-purple-800">
            {logs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-green-600 font-medium">Unique Cases</p>
          <p className="text-3xl font-bold text-green-800">
            {new Set(logs.filter(l => l.caseId).map(l => l.caseId)).size}
          </p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">📋</div>
            <p>No audit logs found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200 text-left">
                <th className="pb-3 px-3 text-sm font-semibold text-gray-600">Timestamp</th>
                <th className="pb-3 px-3 text-sm font-semibold text-gray-600">Report ID</th>
                <th className="pb-3 px-3 text-sm font-semibold text-gray-600">User</th>
                <th className="pb-3 px-3 text-sm font-semibold text-gray-600">Query</th>
                <th className="pb-3 px-3 text-sm font-semibold text-gray-600">Result</th>
                <th className="pb-3 px-3 text-sm font-semibold text-gray-600">Case ID</th>
                <th className="pb-3 px-3 text-sm font-semibold text-gray-600">Hash</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-3 text-sm">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-3">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {log.reportId}
                    </code>
                  </td>
                  <td className="py-3 px-3 text-sm">{log.createdBy}</td>
                  <td className="py-3 px-3">
                    <div className="text-sm">
                      <span className="font-mono">{log.queryInput}</span>
                      <span className="ml-2 text-xs text-gray-500">({log.queryMode})</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    {log.resultUserId ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        User {log.resultUserId}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {log.caseId ? (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {log.caseId}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <code className="text-xs text-gray-600" title={log.snapshotHash}>
                      {log.snapshotHash.substring(0, 8)}...
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination (if needed) */}
      {logs.length > 20 && (
        <div className="flex justify-center mt-6 gap-2">
          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">Previous</button>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">1</button>
          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">2</button>
          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">Next</button>
        </div>
      )}
    </div>
  );
}
