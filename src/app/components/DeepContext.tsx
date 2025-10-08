// FILE: src/app/components/DeepContext.tsx
// Deep Context Lookup - Profile intelligence panel

'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface ProfileData {
  user: {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    createdAt: string;
    description: string;
    isBanned: boolean;
  };
  counts: {
    friends: number;
    followers: number;
    following: number;
  };
  profile: {
    bio: string;
    detectedMentions: string[];
    keywords: string[];
  };
  groups: Array<{
    name: string;
    role: string;
    id: string;
    joinedAt: string;
    isOwner: boolean;
    riskTag: 'low' | 'med' | 'high';
  }>;
  history: {
    pastDisplayNames: string[];
    pastUsernames: string[];
  };
}

interface DeepContextProps {
  userId: string;
  onClose: () => void;
}

export default function DeepContext({ userId, onClose }: DeepContextProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'activity' | 'flags'>('overview');
  const [showMentions, setShowMentions] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/profile/${userId}`);
      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const calculateAccountAge = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const years = now.getFullYear() - created.getFullYear();
    const months = now.getMonth() - created.getMonth();
    return `${years} years, ${months} months`;
  };

  const copySummary = () => {
    if (!profile) return;
  
    const summary = `User @${profile.user.username} (Display: ${profile.user.displayName}, ID: ${profile.user.userId}) - Account created ${new Date(profile.user.createdAt).toLocaleDateString()} (${calculateAccountAge(profile.user.createdAt)}). Friends: ${profile.counts.friends}. Bio mentions: ${profile.profile.detectedMentions.join(', ') || 'None'}. Groups: ${profile.groups.slice(0, 3).map(g => g.name).join(', ')}. Flags: ${profile.profile.keywords.join(', ') || 'None'}. Generated ${new Date().toLocaleString()}.`;
  
    navigator.clipboard.writeText(summary);
    alert('Summary copied to clipboard!');
  };

  const exportPDF = () => {
    // Simple implementation - opens print dialog
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Profile Not Found</h2>
          <p>Unable to load profile data for user {userId}</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <h2 className="text-3xl font-bold">Deep Context Profile</h2>
            <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl">×</button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Column - Identity Card */}
          <div className="w-1/3 bg-gray-50 p-6 overflow-y-auto border-r">
            <div className="text-center mb-6">
              <Image 
                src={profile.user.avatarUrl} 
                alt="Avatar" 
                width={128} 
                height={128} 
                className="rounded-full mx-auto mb-4 border-4 border-white shadow-lg"
              />
              <h3 className="text-2xl font-bold text-gray-800">{profile.user.displayName}</h3>
              <p className="text-gray-600">@{profile.user.username}</p>
              {profile.user.isBanned && (
                <span className="inline-block mt-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                  Banned
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-sm text-gray-600">User ID</p>
                <p className="font-mono font-bold">{profile.user.userId}</p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-sm text-gray-600">Account Age</p>
                <p className="font-bold">{calculateAccountAge(profile.user.createdAt)}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(profile.user.createdAt).toLocaleDateString()}</p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-sm text-gray-600">Friends</p>
                <p className="font-bold text-2xl">{profile.counts.friends.toLocaleString()}</p>
              </div>

              {profile.profile.keywords.length > 0 && (
                <div className="bg-yellow-50 p-4 rounded-lg shadow border-l-4 border-yellow-400">
                  <p className="text-sm font-bold text-yellow-800 mb-2">⚠️ Flags Detected</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.profile.keywords.map((kw, idx) => (
                      <span key={idx} className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded">
                        {kw.replace('flag:', '')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-2">
              <button onClick={copySummary} className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">
                📋 Copy Summary
              </button>
              <button onClick={exportPDF} className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition">
                📄 Export PDF
              </button>
            </div>
          </div>

          {/* Right Column - Context Tabs */}
          <div className="w-2/3 flex flex-col">
            {/* Tab Navigation */}
            <div className="flex border-b bg-white">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 font-medium transition ${
                  activeTab === 'overview' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('groups')}
                className={`px-6 py-3 font-medium transition ${
                  activeTab === 'groups' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Groups & Roles
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`px-6 py-3 font-medium transition ${
                  activeTab === 'activity' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Activity
              </button>
              <button
                onClick={() => setActiveTab('flags')}
                className={`px-6 py-3 font-medium transition ${
                  activeTab === 'flags' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Linked Mentions
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h4 className="font-bold text-lg mb-3">Bio / Description</h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{profile.user.description || 'No description'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-lg shadow">
                      <p className="text-sm text-gray-600 mb-1">Friends</p>
                      <p className="text-2xl font-bold">{profile.counts.friends.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow">
                      <p className="text-sm text-gray-600 mb-1">Groups</p>
                      <p className="text-2xl font-bold">{profile.groups.length}</p>
                    </div>
                  </div>

                  {profile.user.isBanned && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4">
                      <p className="font-bold text-red-800">Account Status: Banned</p>
                      <p className="text-sm text-red-600">This account has been banned by Roblox.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'groups' && (
                <div className="space-y-3">
                  {profile.groups.length === 0 ? (
                    <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
                      No groups found
                    </div>
                  ) : (
                    profile.groups.map((group, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-lg shadow hover:shadow-md transition">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-bold text-lg">{group.name}</h4>
                            <p className="text-sm text-gray-600">Role: {group.role}</p>
                            {group.isOwner && (
                              <span className="inline-block mt-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                                Owner
                              </span>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded text-xs font-medium ${
                            group.riskTag === 'high' ? 'bg-red-100 text-red-800' :
                            group.riskTag === 'med' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {group.riskTag.toUpperCase()} RISK
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-4">
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h4 className="font-bold text-lg mb-3">Recent Activity</h4>
                    <p className="text-gray-500">Name change history not available via public API</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h4 className="font-bold text-lg mb-3">Last Online</h4>
                    <p className="text-gray-500">Not available via public API</p>
                  </div>
                </div>
              )}

              {activeTab === 'flags' && (
                <div className="space-y-4">
                  <div className="bg-white p-6 rounded-lg shadow">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-lg">Detected External Mentions</h4>
                      <button
                        onClick={() => setShowMentions(!showMentions)}
                        className="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                      >
                        {showMentions ? '🔒 Hide' : '👁️ Reveal'}
                      </button>
                    </div>
                    {profile.profile.detectedMentions.length === 0 ? (
                      <p className="text-gray-500">No external mentions detected</p>
                    ) : (
                      <div className="space-y-2">
                        {profile.profile.detectedMentions.map((mention, idx) => (
                          <div key={idx} className="p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                            <p className="font-mono text-sm">
                              {showMentions ? mention : mention.replace(/[a-z0-9]/gi, '*')}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow">
                    <h4 className="font-bold text-lg mb-4">Keyword Flags</h4>
                    {profile.profile.keywords.length === 0 ? (
                      <p className="text-gray-500">No concerning keywords detected</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {profile.profile.keywords.map((kw, idx) => (
                          <span key={idx} className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg font-medium">
                            {kw.replace('flag:', '')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}