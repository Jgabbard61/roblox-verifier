// FILE: src/app/lib/ranking.ts
// Smart Suggest - Weighted ranking algorithm

import levenshtein from 'fast-levenshtein';

export interface RankingWeights {
  nameSimilarity: number;
  accountSignals: number;
  keywordHits: number;
  groupOverlap: number;
  profileCompleteness: number;
}

export const DEFAULT_WEIGHTS: RankingWeights = {
  nameSimilarity: 0.40,
  accountSignals: 0.25,
  keywordHits: 0.15,
  groupOverlap: 0.10,
  profileCompleteness: 0.10,
};

interface UserCandidate {
  id: number;
  name: string;
  displayName: string;
  hasVerifiedBadge: boolean;
  created?: string;
  description?: string;
}

interface RankingHints {
  keywords?: string[];
  groupIds?: string[];
}

interface ScoredCandidate {
  user: UserCandidate;
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

function normalizeString(str: string): string {
  return str.toLowerCase().trim();
}

function jaroWinkler(s1: string, s2: string): number {
  // Simplified Jaro-Winkler implementation
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const matchDistance = Math.floor(longer.length / 2) - 1;
  const longerMatches = new Array(longer.length).fill(false);
  const shorterMatches = new Array(shorter.length).fill(false);
  
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, longer.length);
    
    for (let j = start; j < end; j++) {
      if (longerMatches[j] || shorter[i] !== longer[j]) continue;
      shorterMatches[i] = true;
      longerMatches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0.0;
  
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (!shorterMatches[i]) continue;
    while (!longerMatches[k]) k++;
    if (shorter[i] !== longer[k]) transpositions++;
    k++;
  }
  
  const jaro = (matches / shorter.length + matches / longer.length + (matches - transpositions / 2) / matches) / 3;
  
  // Winkler modification
  let prefixLength = 0;
  for (let i = 0; i < Math.min(4, shorter.length); i++) {
    if (s1[i] === s2[i]) prefixLength++;
    else break;
  }
  
  return jaro + prefixLength * 0.1 * (1 - jaro);
}

function calculateNameSimilarity(query: string, candidate: UserCandidate): number {
  const normalizedQuery = normalizeString(query);
  const normalizedUsername = normalizeString(candidate.name);
  const normalizedDisplay = normalizeString(candidate.displayName);
  
  // Exact matches
  if (normalizedDisplay === normalizedQuery) return 1.0;
  if (normalizedUsername === normalizedQuery) return 0.95;
  
  // Starts with
  if (normalizedDisplay.startsWith(normalizedQuery)) return 0.85;
  if (normalizedUsername.startsWith(normalizedQuery)) return 0.80;
  
  // Contains
  if (normalizedDisplay.includes(normalizedQuery)) return 0.70;
  if (normalizedUsername.includes(normalizedQuery)) return 0.65;
  
  // Jaro-Winkler similarity
  const displaySimilarity = jaroWinkler(normalizedQuery, normalizedDisplay);
  const usernameSimilarity = jaroWinkler(normalizedQuery, normalizedUsername);
  
  // Use the better of the two
  const maxSimilarity = Math.max(displaySimilarity, usernameSimilarity);
  
  // Also check Levenshtein distance for close matches
  const displayDistance = levenshtein.get(normalizedQuery, normalizedDisplay);
  const usernameDistance = levenshtein.get(normalizedQuery, normalizedUsername);
  const minDistance = Math.min(displayDistance, usernameDistance);
  
  if (minDistance <= 2) return Math.max(maxSimilarity, 0.75);
  if (minDistance <= 3) return Math.max(maxSimilarity, 0.60);
  
  return maxSimilarity;
}

function calculateAccountSignals(candidate: UserCandidate): number {
  let score = 0;
  
  // Verified badge
  if (candidate.hasVerifiedBadge) {
    score += 0.4;
  }
  
  // Account age (if available)
  if (candidate.created) {
    const created = new Date(candidate.created);
    const now = new Date();
    const ageInDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    
    // Older accounts are more reliable
    if (ageInDays > 365 * 3) score += 0.3; // 3+ years
    else if (ageInDays > 365) score += 0.2; // 1+ year
    else if (ageInDays > 90) score += 0.1; // 90+ days
  } else {
    // No age info, give moderate score
    score += 0.15;
  }
  
  // Profile completeness contributes to account signals too
  if (candidate.description && candidate.description.length > 10) {
    score += 0.3;
  } else if (candidate.description) {
    score += 0.15;
  }
  
  return Math.min(score, 1.0);
}

function calculateKeywordHits(candidate: UserCandidate, hints?: RankingHints): number {
  if (!hints?.keywords || hints.keywords.length === 0) return 0.5; // Neutral
  if (!candidate.description) return 0;
  
  const normalizedBio = normalizeString(candidate.description);
  let hits = 0;
  
  hints.keywords.forEach(keyword => {
    if (normalizedBio.includes(normalizeString(keyword))) {
      hits++;
    }
  });
  
  return Math.min(hits / hints.keywords.length, 1.0);
}

function calculateGroupOverlap(hints?: RankingHints): number {
  // This would require fetching groups per candidate - expensive
  // For now, return neutral score
  // In production, could be implemented with cached group data
  if (!hints?.groupIds || hints.groupIds.length === 0) return 0.5;
  return 0.5; // Neutral - implement if group data available
}

function calculateProfileCompleteness(candidate: UserCandidate): number {
  let score = 0;
  
  // Has display name different from username
  if (candidate.displayName && candidate.displayName !== candidate.name) {
    score += 0.3;
  }
  
  // Has description
  if (candidate.description) {
    if (candidate.description.length > 50) score += 0.4;
    else if (candidate.description.length > 10) score += 0.3;
    else score += 0.1;
  }
  
  // Has verified badge
  if (candidate.hasVerifiedBadge) {
    score += 0.3;
  }
  
  return Math.min(score, 1.0);
}

export function rankCandidates(
  query: string,
  candidates: UserCandidate[],
  hints?: RankingHints,
  weights: RankingWeights = DEFAULT_WEIGHTS
): ScoredCandidate[] {
  const scored = candidates.map(candidate => {
    const signals = {
      nameSimilarity: calculateNameSimilarity(query, candidate),
      accountSignals: calculateAccountSignals(candidate),
      keywordHits: calculateKeywordHits(candidate, hints),
      groupOverlap: calculateGroupOverlap(hints),
      profileCompleteness: calculateProfileCompleteness(candidate),
    };
    
    // Calculate weighted confidence score
    const confidence = Math.round(
      (signals.nameSimilarity * weights.nameSimilarity +
       signals.accountSignals * weights.accountSignals +
       signals.keywordHits * weights.keywordHits +
       signals.groupOverlap * weights.groupOverlap +
       signals.profileCompleteness * weights.profileCompleteness) * 100
    );
    
    // Generate breakdown explanation
    const breakdown: string[] = [];
    if (signals.nameSimilarity >= 0.9) breakdown.push('Exact name match');
    else if (signals.nameSimilarity >= 0.8) breakdown.push('Strong name similarity');
    else if (signals.nameSimilarity >= 0.6) breakdown.push('Moderate name similarity');
    
    if (candidate.hasVerifiedBadge) breakdown.push('Verified badge');
    if (signals.accountSignals >= 0.7) breakdown.push('Established account');
    if (signals.profileCompleteness >= 0.7) breakdown.push('Complete profile');
    if (signals.keywordHits >= 0.5 && hints?.keywords) breakdown.push('Keyword matches');
    
    return {
      user: candidate,
      confidence,
      signals,
      breakdown,
    };
  });
  
  // Sort by confidence descending
  return scored.sort((a, b) => b.confidence - a.confidence);
}

export function getTopSuggestions(
  query: string,
  candidates: UserCandidate[],
  limit: number = 5,
  hints?: RankingHints,
  weights?: RankingWeights
): ScoredCandidate[] {
  const ranked = rankCandidates(query, candidates, hints, weights);
  return ranked.slice(0, limit);
}
