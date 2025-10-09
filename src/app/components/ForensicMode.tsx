// FILE: src/app/components/ForensicMode.tsx
// Forensic Mode - Toggle, report generation, and audit logging UI

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

interface ForensicModeProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  currentSnapshot?: Record<string, unknown> | null;
  query?: { input: string; mode: 'userId' | 'username' | 'displayName' | 'url' } | null;
}

interface FieldSelector {
  user: boolean;
  counts: boolean;
  profile: boolean;
  groups: boolean;
  history: boolean;
}

export default function ForensicMode({ 
  isEnabled, 
  onToggle, 
  currentSnapshot,
  query 
}: ForensicModeProps) {
  const { data: session } = useSession();
  const [generating, setGenerating] = useState(false);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [caseId, setCaseId] = useState('');
  const [fieldSelector, setFieldSelector] = useState<FieldSelector>({
    user: true,
    counts: true,
    profile: true,
    groups: true,
    history: true,
  });

  const generateReport = async (format: 'json' | 'pdf') => {
    if (!currentSnapshot || !query) {
      alert('No data available to generate report');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/forensic/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot: currentSnapshot,
          query,
          caseId: caseId || undefined,
          fieldSelector,
          format,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      if (format === 'json') {
        const report = await response.json();
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `forensic-report-${report.meta.reportId}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const html = await response.text();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
      
        // Open in new window for printing
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
          };
        }
        URL.revokeObjectURL(url);
      }

      alert(`Forensic report generated successfully!`);
    } catch (error) {
      console.error('Report generation error:', error);
      alert('Failed to generate report. Please try again.');
    }
    setGenerating(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      {/* Toggle Section */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            onClick={() => onToggle(!isEnabled)}
            className={`relative w-14 h-8 rounded-full cursor-pointer transition-colors ${
              isEnabled ? 'bg-purple-600' : 'bg-gray-300'
            }`}
          >
            <div
              className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                isEnabled ? 'transform translate-x-6' : ''
              }`}
            />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Forensic Mode</h3>
            <p className="text-sm text-gray-600">
              {isEnabled ? 'Active - Generating immutable logs' : 'Inactive'}
            </p>
          </div>
        </div>
      
        {isEnabled && (
          <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 border-l-4 border-purple-600 rounded">
            <span className="text-2xl">🔒</span>
            <span className="text-sm font-medium text-purple-800">
              Forensic Logging Active
            </span>
          </div>
        )}
      </div>

      {/* Forensic Controls */}
      {isEnabled && (
        <div className="border-t pt-4 mt-4 space-y-4">
          {/* Case ID Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Case ID (Optional)
            </label>
            <input
              type="text"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              placeholder="Enter case reference number..."
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Field Selector Toggle */}
          <div>
            <button
              onClick={() => setShowFieldSelector(!showFieldSelector)}
              className="text-sm text-purple-600 hover:text-purple-800 font-medium"
            >
              {showFieldSelector ? '▼' : '▶'} Configure Export Fields
            </button>
          </div>

          {/* Field Selector Panel */}
          {showFieldSelector && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="text-sm text-gray-600 mb-3">
                Select which data fields to include in the report:
              </p>
              {Object.entries(fieldSelector).map(([field, checked]) => (
                <label key={field} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setFieldSelector({ ...fieldSelector, [field]: e.target.checked })
                    }
                    className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm capitalize">{field}</span>
                </label>
              ))}
            </div>
          )}

          {/* Report Generation Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => generateReport('json')}
              disabled={generating || !currentSnapshot}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 transition font-medium shadow-md flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Generating...
                </>
              ) : (
                <>
                  📥 Download JSON Report
                </>
              )}
            </button>
            <button
              onClick={() => generateReport('pdf')}
              disabled={generating || !currentSnapshot}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 transition font-medium shadow-md flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Generating...
                </>
              ) : (
                <>
                  📄 Generate PDF Report
                </>
              )}
            </button>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
            <p className="text-sm text-blue-800">
              <strong>📌 Forensic Mode Features:</strong>
              <br />• SHA-256 hash verification of all data
              <br />• Timestamped evidence snapshots
              <br />• Chain-of-custody tracking
              <br />• Immutable audit logs
              <br />• Legal-defensible exports
            </p>
          </div>

          {/* Current User Info */}
          {session && (
            <div className="text-xs text-gray-500 text-center pt-2 border-t">
              Reports will be attributed to: <strong>{session.user?.email || session.user?.name}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}