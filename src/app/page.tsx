'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import Papa from 'papaparse';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';


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
}

type RobloxResponse = UserResult | { error: string };

interface Suggestion {
  user: UserResult;
  score: number;
  reason: string;
}

interface BatchOutput {
  input: string;
  status: string;
  details?: string;
  suggestions?: Suggestion[];
  avatar?: number;
}

function rankResults(results: UserResult[], query: string): Suggestion[] {
  const ranked = results.map(user => {
    const lowerQuery = query.toLowerCase();
    const lowerDisplay = user.displayName.toLowerCase();
    const lowerName = user.name.toLowerCase();

    let score = 0;
    let reason = '';

    if (lowerDisplay === lowerQuery) { score = 100; reason = 'Exact display name'; }
    else if (lowerDisplay.startsWith(lowerQuery)) { score = 80; reason = 'Display name starts with'; }
    else if (lowerName === lowerQuery) { score = 70; reason = 'Exact username'; }
    else if (levenshtein.get(lowerName, lowerQuery) <= 2) { score = 60; reason = 'Close username match'; }
    else if (lowerDisplay.includes(lowerQuery)) { score = 50; reason = 'Display name contains'; }

    return { user, score, reason };
  });

  return ranked.filter(item => item.score > 0).sort((a, b) => b.score - a.score);
}

function VerifierTool() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [input, setInput] = useState('');
  const [result, setResult] = useState<ReactNode | null>(null);
  const [includeBanned, setIncludeBanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchOutput[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent, batchInputs: string[] = []) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setBatchResults([]);
    setIsBatchMode(batchInputs.length > 0);

    const inputs = batchInputs.length > 0 ? batchInputs : [input];
    const outputs: BatchOutput[] = [];

    for (const singleInput of inputs) {
      const parsed = normalizeInput(singleInput);
      if (parsed.type === 'invalid') {
        outputs.push({ input: singleInput, status: 'Invalid', details: 'Invalid input' });
        continue;
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
          response = await fetch(`/api/search?keyword=${encodeURIComponent(parsed.value)}&limit=10`);
          if (!response.ok) throw new Error('Roblox API error');
          const searchData = await response.json();
          const suggestions = rankResults(searchData.data || [], parsed.value);
          outputs.push({ input: singleInput, status: suggestions.length > 0 ? 'Suggestions' : 'Not Found', suggestions, details: suggestions.length === 0 ? 'No matches' : undefined });
          continue;
        }

        if (user && !('error' in user)) {
          outputs.push({
            input: singleInput,
            status: 'Verified',
            details: `Username: ${user.name}, Display Name: ${user.displayName}, ID: ${user.id}, Verified Badge: ${user.hasVerifiedBadge ? 'Yes' : 'No'}`,
            avatar: user.id
          });
        } else {
          response = await fetch(`/api/search?keyword=${encodeURIComponent(parsed.value)}&limit=10`);
          if (!response.ok) throw new Error('Roblox API error');
          const searchData = await response.json();
          const suggestions = rankResults(searchData.data || [], parsed.value);
          outputs.push({ input: singleInput, status: suggestions.length > 0 ? 'Suggestions' : 'Not Found', suggestions, details: suggestions.length === 0 ? 'No matches' : undefined });
        }
      } catch (error: unknown) {
        console.error('API Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Could not connect to Roblox API. Try again.';
        outputs.push({ input: singleInput, status: 'Error', details: errorMessage });
      }
    }

    setBatchResults(outputs);

    if (!isBatchMode && outputs.length === 1) {
      const out = outputs[0];
      if (out.status === 'Verified') {
        setResult(
          <div className="bg-green-50 border border-green-200 p-5 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold text-green-800 mb-3">✓ Verified!</h2>
            <div className="flex items-center space-x-4">
              {out.avatar && (
                <Image 
                  src={`/api/thumbnail?userId=${out.avatar}`} 
                  alt="Avatar" 
                  width={64} 
                  height={64} 
                  className="rounded-full border-2 border-green-300 shadow-md" 
                />
              )}
              <p className="text-gray-700">{out.details}</p>
            </div>
          </div>
        );
      } else if (out.suggestions) {
        setResult(
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-yellow-800">Suggestions:</h2>
            {out.suggestions.map((sug, idx) => (
              <div 
                key={idx} 
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 cursor-pointer transition-all shadow-sm flex items-center space-x-4" 
                onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent, [sug.user.name])}
              >
                <Image 
                  src={`/api/thumbnail?userId=${sug.user.id}`} 
                  alt="Avatar" 
                  width={48} 
                  height={48} 
                  className="rounded-full border border-gray-300" 
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">Username: {sug.user.name}</p>
                  <p className="text-gray-600">Display: {sug.user.displayName}</p>
                  <p className="text-sm text-gray-500">Score: {sug.score} ({sug.reason})</p>
                </div>
              </div>
            ))}
          </div>
        );
      } else {
        setResult(
          <div className="bg-red-50 border border-red-200 p-5 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold text-red-800 mb-2">{out.status}</h2>
            <p className="text-gray-700">{out.details}</p>
          </div>
        );
      }
      setInput('');
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
    const csvData = data.map(out => ({
      Input: out.input,
      Status: out.status,
      Details: out.details || (out.suggestions ? `Found ${out.suggestions.length} suggestions` : '')
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'roblox_verifier_batch_results.csv';
    link.click();
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with Logout */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">Roblox Verifier Tool</h1>
            <p className="text-gray-600 mt-1">Verify usernames, display names, and profiles</p>
          </div>
          <button 
            onClick={() => signOut({ callbackUrl: '/auth/signin' })} 
            className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-6 rounded-lg transition-colors shadow-md"
          >
            Logout
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-2xl p-8 border border-gray-100">
          {/* Verification Form */}
          <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
            <div>
              <label htmlFor="verifier-input" className="block text-sm font-medium text-gray-700 mb-2">
                Enter Username, Display Name, or URL
              </label>
              <input
                id="verifier-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g., Roblox, @username, or profile URL"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all text-gray-900 placeholder-gray-400"
              />
            </div>

            <div className="flex items-center space-x-3">
              <input 
                id="include-banned"
                type="checkbox" 
                checked={includeBanned} 
                onChange={(e) => setIncludeBanned(e.target.checked)} 
                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor="include-banned" className="text-gray-700 cursor-pointer select-none">
                Include banned/unavailable accounts
              </label>
            </div>

            <button 
              type="submit" 
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 py-3 text-white font-semibold disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg" 
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verifying...
                </span>
              ) : (
                'Verify'
              )}
            </button>
          </form>

          {/* Batch Upload Section */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center">
              Batch Upload (CSV)
              <span className="relative inline-block ml-2 group">
                <span className="cursor-help bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">i</span>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg py-2 px-3 w-72 z-10 shadow-lg">
                  Upload a CSV file with one column of usernames, display names, or URLs. No headers needed.
                  <br/><br/>
                  <strong>Example:</strong><br/>
                  Roblox<br/>
                  @FakeUser<br/>
                  123456<br/>
                  https://www.roblox.com/users/1/profile
                </div>
              </span>
            </label>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleBatchUpload} 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Loading State */}
          {loading && (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center text-blue-600 font-medium">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              {result}
            </div>
          )}

          {/* Batch Results Table */}
          {isBatchMode && batchResults.length > 0 && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Batch Results</h2>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Input</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {batchResults.map((out, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{out.input}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            out.status === 'Verified' ? 'bg-green-100 text-green-800' :
                            out.status === 'Suggestions' ? 'bg-yellow-100 text-yellow-800' :
                            out.status === 'Error' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {out.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{out.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button 
                onClick={() => exportToCSV(batchResults)} 
                className="mt-4 rounded-lg bg-green-600 hover:bg-green-700 px-6 py-3 text-white font-semibold transition-colors shadow-md hover:shadow-lg"
              >
                Export to CSV
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>Powered by Roblox API • Built with Next.js</p>
        </div>
      </div>
    </main>
  );
}

export default VerifierTool;
