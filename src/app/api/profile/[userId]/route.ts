
// FILE: src/app/api/profile/[userId]/route.ts
// Deep Context Lookup - Profile aggregation API

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface GroupRole {
  group: {
    id: number;
    name: string;
    memberCount: number;
  };
  role: {
    id: number;
    name: string;
    rank: number;
  };
}

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

// Risk tags for groups (configurable)
const GROUP_RISK_TAGS: Record<string, 'low' | 'med' | 'high'> = {
  // Add known risky group IDs here
  // '12345': 'high',
  // '67890': 'med',
};

// Keyword flags (configurable)
const KEYWORD_FLAGS = [
  'discord', 'discord.gg', '@', '#',
  'school', 'age', 'years old', 'yo',
  'instagram', 'twitter', 'youtube',
  'snap', 'tiktok', 'venmo', 'cashapp'
];

function parseBioForMentions(bio: string): string[] {
  const mentions: string[] = [];
  
  // Discord patterns
  if (bio.match(/discord\.gg\/[\w-]+/i)) {
    mentions.push('discord:invite_link');
  }
  if (bio.match(/discord[:\s]+[\w#]+\d{4}/i)) {
    mentions.push('discord:username');
  }
  
  // Twitter/X
  const twitterMatch = bio.match(/@[\w]+\s*(?:twitter|x\.com)/i);
  if (twitterMatch) {
    mentions.push(`x:${twitterMatch[0]}`);
  }
  
  // YouTube
  const youtubeMatch = bio.match(/youtube\.com\/(c\/|@)?[\w-]+/i);
  if (youtubeMatch) {
    mentions.push(`youtube:${youtubeMatch[0]}`);
  }
  
  return mentions;
}

function detectKeywords(bio: string): string[] {
  const detected: string[] = [];
  const lowerBio = bio.toLowerCase();
  
  KEYWORD_FLAGS.forEach(keyword => {
    if (lowerBio.includes(keyword.toLowerCase())) {
      detected.push(`flag:${keyword}`);
    }
  });
  
  return detected;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    // Parallel API calls for performance
    const [userResponse, groupsResponse, friendsResponse] = await Promise.allSettled([
      fetch(`https://users.roblox.com/v1/users/${userId}`),
      fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`),
      fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
    ]);

    // Parse user data
    let userData = null;
    if (userResponse.status === 'fulfilled' && userResponse.value.ok) {
      userData = await userResponse.value.json();
    } else {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse groups data
    let groupsData: GroupRole[] = [];
    if (groupsResponse.status === 'fulfilled' && groupsResponse.value.ok) {
      const groupsJson = await groupsResponse.value.json();
      groupsData = groupsJson.data || [];
    }

    // Parse friends count
    let friendsCount = 0;
    if (friendsResponse.status === 'fulfilled' && friendsResponse.value.ok) {
      const friendsJson = await friendsResponse.value.json();
      friendsCount = friendsJson.count || 0;
    }

    // Build profile data
    const bio = userData.description || '';
    const detectedMentions = parseBioForMentions(bio);
    const keywords = detectKeywords(bio);

    const profileData: ProfileData = {
      user: {
        userId: userData.id.toString(),
        username: userData.name,
        displayName: userData.displayName,
        avatarUrl: `/api/thumbnail?userId=${userData.id}`,
        createdAt: userData.created,
        description: bio,
        isBanned: userData.isBanned || false,
      },
      counts: {
        friends: friendsCount,
        followers: 0, // Not available via API
        following: 0, // Not available via API
      },
      profile: {
        bio,
        detectedMentions,
        keywords,
      },
      groups: groupsData.slice(0, 10).map((g) => ({
        name: g.group.name,
        role: g.role.name,
        id: g.group.id.toString(),
        joinedAt: new Date().toISOString(), // Not available via API
        isOwner: g.role.rank === 255,
        riskTag: GROUP_RISK_TAGS[g.group.id.toString()] || 'low',
      })),
      history: {
        pastDisplayNames: [], // Not available via API
        pastUsernames: [], // Not available via API
      },
    };

    return NextResponse.json(profileData, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800', // 15 min cache
      },
    });
  } catch (error) {
    console.error('Profile API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
