// FILE: src/app/page.tsx (FIXED VERSION)
// Fixes: 1) Clicking suggestion now verifies immediately
//        2) Subsequent searches work correctly
//        3) Proper state management for verification flow

'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import Papa from 'papaparse';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// Import new components
import DeepContext from './components/DeepContext';
import SmartSuggest from './components/SmartSuggest';
import ForensicMode from './components/ForensicMode';
import { getTopSuggestions } from './lib/ranking';

import levenshtein from 'fast-levenshtein';

function normalizeInput(rawInput: string): { type: 'username' | 'displayName' | 'userId' | 'url' | 'invalid'; value: string; userId?: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) return { type: 'invalid', value: '' };

  const urlMatch = trimmed.match(/roblox\.com\/users\/(\d+)\/profile/i);
  if (urlMatch) return { type: 'url', value: trimmed, userId: urlMatch[1] };

  if (/^\d+$/.test(trimmed)) return { type: 'userId', value: trimmed };

  const usernameMatch = trimmed.match(/^@?([a-zA-Z0-9_]+)$/);
  if (usernameMatch) return { type: 'username', value: usernameMatch[1] };

  return { type: 'displayName', value: trimmed };
}

interface UserResult {
  id: number;
  name: string;
  displayName: string;
  hasVerifiedBadge: boolean;
  created?: string;
  description?: string;
}

type RobloxResponse = UserResult | { error: string };

interface ScoredCandidate {
  user: UserResult;
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

interface BatchOutput {
  input: string;
  status: string;
  details?: string;
  suggestions?: ScoredCandidate[];
  avatar?: number;
}

function VerifierTool() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Existing state
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ReactNode | null>(null);
  const [includeBanned, setIncludeBanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchOutput[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);

  // NEW: Feature state
  const [forensicMode, setForensicMode] = useState(false);
  const [currentSnapshot, setCurrentSnapshot] = useState<any>(null);
  const [currentQuery, setCurrentQuery] = useState<any>(null);
  const [showDeepContext, setShowDeepContext] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [scoredCandidates, setScoredCandidates] = useState<ScoredCandidate[]>([]);
  
  // FIX: Track the ORIGINAL display name query separately from the input field
  const [originalDisplayNameQuery, setOriginalDisplayNameQuery] = useState<string>('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent, batchInputs: string[] = [], skipInputClear: boolean = false) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setBatchResults([]);
    // FIX: Don't clear suggestions here - let them persist until we have a result
    setIsBatchMode(batchInputs.length > 0);

    const inputs = batchInputs.length > 0 ? batchInputs : [input];
    const outputs: BatchOutput[] = [];

    for (const singleInput of inputs) {
      const parsed = normalizeInput(singleInput);
      if (parsed.type === 'invalid') {
        outputs.push({ input: singleInput, status: 'Invalid', details: 'Invalid input' });
        continue;
      }

      // Store query for forensic mode
      if (forensicMode && !isBatchMode) {
        setCurrentQuery({ input: parsed.value, mode: parsed.type });
      }

      try {
        let response;
        let user: RobloxResponse | null = null;

        if (parsed.type === 'username') {
          response = await fetch('/api/roblox', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: parsed.value, includeBanned }),
          });
          if (!response.ok) throw new Error('Roblox API error');
          const data = await response.json();
          user = data.data?.[0] || null;
        } else if (parsed.type === 'userId' || parsed.type === 'url') {
          const id = parsed.userId || parsed.value;
          response = await fetch(`/api/roblox?userId=${id}`);
          if (!response.ok) throw new Error('Roblox API error');
          user = await response.json();
        } else {
          // Display name - use Smart Suggest with ranking
          // FIX: Store the original display name query for later use
          if (!isBatchMode) {
            setOriginalDisplayNameQuery(parsed.value);
          }
          
          response = await fetch(`/api/search?keyword=${encodeURIComponent(parsed.value)}&limit=10`);
          if (!response.ok) throw new Error('Roblox API error');
          const searchData = await response.json();
          
          // NEW: Use weighted ranking algorithm
          const candidates = getTopSuggestions(parsed.value, searchData.data || [], 10);
          
          if (!isBatchMode) {
            setScoredCandidates(candidates);
          }
          
          outputs.push({
            input: singleInput,
            status: candidates.length > 0 ? 'Suggestions' : 'Not Found',
            suggestions: candidates,
            details: candidates.length === 0 ? 'No matches' : undefined,
          });
          continue;
        }

        if (user && !('error' in user)) {
          // NEW: Fetch deep context data for forensic mode
          if (forensicMode && !isBatchMode) {
            try {
              const profileResponse = await fetch(`/api/profile/${user.id}`);
              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                setCurrentSnapshot(profileData);
              }
            } catch (error) {
              console.error('Failed to fetch profile for forensic mode:', error);
            }
          }

          outputs.push({
            input: singleInput,
            status: 'Verified',
            details: `Username: ${user.name}, Display Name: ${user.displayName}, ID: ${user.id}, Verified Badge: ${user.hasVerifiedBadge ? 'Yes' : 'No'}`,
            avatar: user.id,
          });
        } else {
          // Fallback to suggestions with ranking
          response = await fetch(`/api/search?keyword=${encodeURIComponent(parsed.value)}&limit=10`);
          if (!response.ok) throw new Error('Roblox API error');
          const searchData = await response.json();
          const candidates = getTopSuggestions(parsed.value, searchData.data || [], 10);
          
          if (!isBatchMode) {
            setScoredCandidates(candidates);
          }
          
          outputs.push({
            input: singleInput,
            status: candidates.length > 0 ? 'Suggestions' : 'Not Found',
            suggestions: candidates,
            details: candidates.length === 0 ? 'No matches' : undefined,
          });
        }
      } catch (error: unknown) {
        console.error('API Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Could not connect to Roblox API. Try again.';
        outputs.push({ input: singleInput, status: 'Error', details: errorMessage });
      }
    }

    setBatchResults(outputs);

    // Render single result
    if (!isBatchMode && outputs.length === 1) {
      const out = outputs[0];
      
      // FIX: Only clear input if we're NOT skipping (i.e., not from a suggestion click)
      if (!skipInputClear) {
        setInput('');
      }
      
      if (out.status === 'Verified') {
        // FIX: Clear suggestions when we have a verified result
        setScoredCandidates([]);
        
        setResult(
          <div className="bg-green-100 p-4 rounded-md">
            <h2 className="text-xl font-bold text-green-800 mb-2">✓ Verified!</h2>
            <p className="mb-3">{out.details}</p>
            {out.avatar && (
              <Image
                src={`/api/thumbnail?userId=${out.avatar}`}
                alt="Avatar"
                width={64}
                height={64}
                className="mt-2 rounded-full"
              />
            )}
            {/* NEW: View Profile button */}
            <button
              onClick={() => {
                setSelectedUserId(out.avatar?.toString() || null);
                setShowDeepContext(true);
              }}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              🔍 View Full Profile
            </button>
          </div>
        );
      } else if (out.status === 'Not Found') {
        // FIX: Clear suggestions when we have a "Not Found" result
        setScoredCandidates([]);
        
        setResult(
          <div className="bg-red-100 p-4 rounded-md">
            <h2 className="text-xl font-bold text-red-800">{out.status}</h2>
            <p>{out.details}</p>
          </div>
        );
      }
      // Smart Suggest will render separately below
    }

    setLoading(false);
  };

  const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse<string[]>(file, {
        complete: (results: Papa.ParseResult<string[]>) => {
          const batchInputs = results.data.flat().filter(Boolean);
          handleSubmit({ preventDefault: () => {} } as React.FormEvent, batchInputs);
        },
        header: false,
      });
    }
  };

  const exportToCSV = (data: BatchOutput[]) => {
    const csvData = data.map((out) => ({
      Input: out.input,
      Status: out.status,
      Details: out.details || (out.suggestions ? `Found ${out.suggestions.length} suggestions` : ''),
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'roblox_verifier_batch_results.csv';
    link.click();
  };

  // FIX: Completely rewritten handleSelectCandidate function
  const handleSelectCandidate = (userId: number) => {
    // FIX: Set loading state immediately to prevent double-clicks
    setLoading(true);
    
    // FIX: Clear suggestions immediately when a candidate is selected
    setScoredCandidates([]);
    
    // FIX: Set the input to the userId
    setInput(userId.toString());
    
    // FIX: Use setTimeout to ensure state updates are processed before calling handleSubmit
    setTimeout(() => {
      handleSubmit({ preventDefault: () => {} } as React.FormEvent, [], true)
        .then(() => {
          // Clear the input field after verification completes
          setInput('');
        })
        .catch((error) => {
          console.error('Verification error:', error);
          setLoading(false);
        });
    }, 0);
  };

  const handleInspectCandidate = (userId: number) => {
    setSelectedUserId(userId.toString());
    setShowDeepContext(true);
  };

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (!session) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="w-full max-w-4xl">
        {/* NEW: Forensic Mode Toggle */}
        {!isBatchMode && (
          <ForensicMode
            isEnabled={forensicMode}
            onToggle={setForensicMode}
            currentSnapshot={currentSnapshot}
            query={currentQuery}
          />
        )}

        {/* Main Verifier Card */}
        <div className="rounded-lg bg-white p-8 shadow-xl">
          <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">
            Roblox Verifier Tool
          </h1>

          <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter username, display name, user ID, or URL"
              className="w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
            />
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={includeBanned}
                onChange={(e) => setIncludeBanned(e.target.checked)}
                className="h-4 w-4 text-blue-500 focus:ring-blue-200"
              />
              <label className="text-gray-700">Include banned/unavailable accounts</label>
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-gradient-to-r from-blue-500 to-purple-600 p-3 text-white font-medium hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 transition shadow-lg"
              disabled={loading}
            >
              {loading ? 'Verifying...' : '🔍 Verify'}
            </button>
          </form>

          {/* Batch Upload */}
          <div className="mt-6">
            <label className="block text-gray-700 mb-2 flex items-center">
              Batch Upload (CSV):
              <span className="relative inline-block ml-2 group">
                <span className="cursor-help bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  i
                </span>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 w-64 z-10">
                  Upload a CSV file with one column of usernames, display names, or URLs. No headers
                  needed.
                </div>
              </span>
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleBatchUpload}
              className="w-full p-2 border rounded-md"
            />
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="mt-4 text-center text-blue-500 font-medium animate-pulse">
              Processing...
            </div>
          )}

          {/* Single result */}
          {result && <div className="mt-6 rounded-md bg-gray-100 p-6 shadow-inner">{result}</div>}

          {/* FIX: Use originalDisplayNameQuery instead of input for the query display */}
          {!isBatchMode && scoredCandidates.length > 0 && (
            <SmartSuggest
              candidates={scoredCandidates}
              query={originalDisplayNameQuery}
              onSelect={handleSelectCandidate}
              onInspect={handleInspectCandidate}
              loading={loading}
            />
          )}

          {/* Batch Results */}
          {isBatchMode && batchResults.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-bold mb-4">Batch Results</h2>
              <table className="w-full border-collapse border">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="p-3 text-left border-b">Input</th>
                    <th className="p-3 text-left border-b">Status</th>
                    <th className="p-3 text-left border-b">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResults.map((out, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-3 border-b">{out.input}</td>
                      <td className="p-3 border-b">{out.status}</td>
                      <td className="p-3 border-b">{out.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={() => exportToCSV(batchResults)}
                className="mt-4 rounded-md bg-green-500 p-3 text-white font-medium hover:bg-green-600 transition"
              >
                📥 Export CSV
              </button>
            </div>
          )}

          {/* Logout button */}
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="mt-6 w-full rounded-md bg-red-500 p-3 text-white font-medium hover:bg-red-600 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* NEW: Deep Context Modal */}
      {showDeepContext && selectedUserId && (
        <DeepContext
          userId={selectedUserId}
          onClose={() => {
            setShowDeepContext(false);
            setSelectedUserId(null);
          }}
        />
      )}
    </main>
  );
}

export default VerifierTool;
