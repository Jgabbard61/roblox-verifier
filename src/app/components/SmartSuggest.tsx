// FILE: src/app/components/SmartSuggest.tsx
// Smart Suggest - Enhanced candidate selection UI

'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ScoredCandidate {
  user: {
    id: number;
    name: string;
    displayName: string;
    hasVerifiedBadge: boolean;
    created?: string;
    description?: string;
  };
  confidence: number;
  signals: {
    nameSimilarity: number;
    accountSignals: number;
    keywordHits: number;
    groupOverlap: number;
    profileCompleteness: number;
  };
  breakdown: string[];
}

interface SmartSuggestProps {
  candidates: ScoredCandidate[];
  query: string;
  onSelect: (username: string) => void;
  onInspect: (userId: number) => void;
  loading?: boolean;
}

export default function SmartSuggest({ 
  candidates, 
  query, 
  onSelect, 
  onInspect,
  loading = false 
}: SmartSuggestProps) {
  const [hints, setHints] = useState({
    keywords: '',
    groupName: '',
    accountAge: '',
  });

  if (loading) {
    return (
      <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="mt-6 bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">No Strong Candidates</h3>
        <p className="text-gray-600 mb-4">
          Try refining your search with additional hints below
        </p>
      
        <div className="max-w-md mx-auto space-y-3">
          <input
            type="text"
            placeholder="Add keywords from bio..."
            value={hints.keywords}
            onChange={(e) => setHints({ ...hints, keywords: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Group name hint..."
            value={hints.groupName}
            onChange={(e) => setHints({ ...hints, groupName: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={hints.accountAge}
            onChange={(e) => setHints({ ...hints, accountAge: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Account age (any)</option>
            <option value="new">New ({"<"}1 year)</option>
            <option value="established">Established (1-3 years)</option>
            <option value="old">Veteran (3+ years)</option>
          </select>
        </div>
      </div>
    );
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-orange-600 bg-orange-100';
  };

  const getConfidenceBorder = (confidence: number) => {
    if (confidence >= 80) return 'border-green-500';
    if (confidence >= 60) return 'border-yellow-500';
    return 'border-orange-500';
  };

  return (
    <div className="mt-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-2">
          Smart Suggestions for &quot;{query}&quot;
        </h3>
        <p className="text-gray-600">
          Found {candidates.length} ranked candidate{candidates.length !== 1 ? 's' : ''} • 
          Click to select or inspect profiles
        </p>
      </div>

      {/* Hint Chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="🔍 Add bio keywords..."
          value={hints.keywords}
          onChange={(e) => setHints({ ...hints, keywords: e.target.value })}
          className="px-3 py-1 text-sm border rounded-full focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <input
          type="text"
          placeholder="👥 Group hint..."
          value={hints.groupName}
          onChange={(e) => setHints({ ...hints, groupName: e.target.value })}
          className="px-3 py-1 text-sm border rounded-full focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <select
          value={hints.accountAge}
          onChange={(e) => setHints({ ...hints, accountAge: e.target.value })}
          className="px-3 py-1 text-sm border rounded-full focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">⏰ Account age</option>
          <option value="new">New</option>
          <option value="established">Established</option>
          <option value="old">Veteran</option>
        </select>
      </div>

      {/* Candidate Cards */}
      <div className="space-y-3">
        {candidates.map((candidate, idx) => (
          <div
            key={candidate.user.id}
            className={`bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-200 p-4 border-l-4 ${getConfidenceBorder(candidate.confidence)} relative overflow-hidden`}
          >
            {/* Rank badge */}
            <div className="absolute top-2 right-2">
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${getConfidenceColor(candidate.confidence)}`}>
                {candidate.confidence}% match
              </span>
            </div>

            {/* Rank number */}
            {idx < 3 && (
              <div className="absolute top-2 left-2 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                #{idx + 1}
              </div>
            )}

            <div className="flex items-start gap-4 mt-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <Image
                  src={`/api/thumbnail?userId=${candidate.user.id}`}
                  alt={`${candidate.user.displayName} avatar`}
                  width={80}
                  height={80}
                  className="rounded-lg shadow-md border-2 border-white"
                />
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-xl font-bold text-gray-800 truncate">
                    {candidate.user.displayName}
                  </h4>
                  {candidate.user.hasVerifiedBadge && (
                    <span className="text-blue-500 text-sm">✓</span>
                  )}
                </div>
                <p className="text-gray-600 mb-2">@{candidate.user.name}</p>
                <p className="text-sm text-gray-500 mb-2">
                  ID: {candidate.user.id}
                </p>

                {/* Breakdown tags */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {candidate.breakdown.map((reason, ridx) => (
                    <span
                      key={ridx}
                      className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                    >
                      {reason}
                    </span>
                  ))}
                </div>

                {/* Bio preview */}
                {candidate.user.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                    {candidate.user.description}
                  </p>
                )}

                {/* Signal bars */}
                <div className="grid grid-cols-5 gap-2 mb-3">
                  <SignalBar
                    label="Name"
                    value={candidate.signals.nameSimilarity}
                  />
                  <SignalBar
                    label="Account"
                    value={candidate.signals.accountSignals}
                  />
                  <SignalBar
                    label="Keywords"
                    value={candidate.signals.keywordHits}
                  />
                  <SignalBar
                    label="Groups"
                    value={candidate.signals.groupOverlap}
                  />
                  <SignalBar
                    label="Profile"
                    value={candidate.signals.profileCompleteness}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onSelect(candidate.user.name)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition font-medium shadow-md"
                  >
                    ✓ Select & Verify
                  </button>
                  <button
                    onClick={() => onInspect(candidate.user.id)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                  >
                    🔍 Inspect
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Show more button if many results */}
      {candidates.length > 5 && (
        <div className="mt-4 text-center">
          <button className="px-6 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition shadow">
            Show More Results
          </button>
        </div>
      )}
    </div>
  );
}

// Helper component for signal strength bars
function SignalBar({ label, value }: { label: string; value: number }) {
  const percentage = Math.round(value * 100);
  const color = percentage >= 70 ? 'bg-green-500' : percentage >= 40 ? 'bg-yellow-500' : 'bg-gray-300';

  return (
    <div className="text-center">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 mt-1">{percentage}%</div>
    </div>
  );
}