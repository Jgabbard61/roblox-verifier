
// FILE: src/app/lib/forensic.ts
// Forensic Report Generator

interface ProfileSnapshot {
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

interface SearchQuery {
  input: string;
  mode: string;
}

export interface FieldSelector {
  includeUser?: boolean;
  includeCounts?: boolean;
  includeProfile?: boolean;
  includeGroups?: boolean;
  includeHistory?: boolean;
}

interface ForensicReport {
  meta: {
    reportId: string;
    createdAt: string;
    createdBy?: { email?: string; name?: string };
    caseId?: string;
  };
  snapshot: ProfileSnapshot;
  query: SearchQuery;
  hash: {
    value: string;
    algorithm: string;
  };
}

// Filter snapshot fields based on selector
export function filterSnapshotFields(
  snapshot: Record<string, unknown>,
  selector: FieldSelector
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  
  if (selector.includeUser !== false && snapshot.user) {
    filtered.user = snapshot.user;
  }
  if (selector.includeCounts !== false && snapshot.counts) {
    filtered.counts = snapshot.counts;
  }
  if (selector.includeProfile !== false && snapshot.profile) {
    filtered.profile = snapshot.profile;
  }
  if (selector.includeGroups !== false && snapshot.groups) {
    filtered.groups = snapshot.groups;
  }
  if (selector.includeHistory !== false && snapshot.history) {
    filtered.history = snapshot.history;
  }
  
  return filtered;
}

// Create forensic report with hash
export async function createForensicReport(
  snapshot: Record<string, unknown>,
  query: SearchQuery,
  createdBy?: { email?: string; name?: string },
  caseId?: string
): Promise<ForensicReport> {
  const timestamp = new Date().toISOString();
  const reportId = `FR-${timestamp.replace(/[:.]/g, '-')}`;
  
  // Create hash of snapshot for integrity
  const snapshotString = JSON.stringify(snapshot);
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(snapshotString)
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return {
    meta: {
      reportId,
      createdAt: timestamp,
      createdBy,
      caseId,
    },
    snapshot: snapshot as unknown as ProfileSnapshot,
    query,
    hash: {
      value: hashHex,
      algorithm: 'SHA-256',
    },
  };
}

// Generate HTML from forensic report
export function generateReportHTML(report: ForensicReport): string {
  return generateForensicReport(report.snapshot, report.query);
}

export function generateForensicReport(
  snapshot: ProfileSnapshot,
  query: SearchQuery
): string {
  const timestamp = new Date().toISOString();
  const accountAge = calculateAccountAge(snapshot.user.createdAt);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forensic Report - ${snapshot.user.username}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      color: #333;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    
    .header .timestamp {
      font-size: 14px;
      opacity: 0.9;
    }
    
    .content {
      padding: 30px;
    }
    
    .section {
      margin-bottom: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    
    .section h2 {
      color: #667eea;
      margin-bottom: 15px;
      font-size: 20px;
    }
    
    .profile-header {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .avatar {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      border: 4px solid #667eea;
    }
    
    .profile-info h3 {
      font-size: 24px;
      margin-bottom: 5px;
    }
    
    .profile-info .username {
      color: #666;
      font-size: 16px;
    }
    
    .label {
      font-weight: 600;
      color: #555;
      margin-bottom: 8px;
    }
    
    .value {
      color: #333;
      line-height: 1.6;
    }
    
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 8px;
      margin-bottom: 8px;
    }
    
    .badge.verified {
      background: #10b981;
      color: white;
    }
    
    .badge.banned {
      background: #ef4444;
      color: white;
    }
    
    .badge.low {
      background: #10b981;
      color: white;
    }
    
    .badge.med {
      background: #f59e0b;
      color: white;
    }
    
    .badge.high {
      background: #ef4444;
      color: white;
    }
    
    .flag {
      display: inline-block;
      padding: 4px 10px;
      background: #fef3c7;
      color: #92400e;
      border-radius: 4px;
      font-size: 12px;
      margin-right: 6px;
      margin-bottom: 6px;
    }
    
    .group-item {
      background: white;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 10px;
      border-left: 3px solid #667eea;
    }
    
    .group-item .group-name {
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .group-item .group-role {
      color: #666;
      font-size: 14px;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    
    .stat-box {
      background: white;
      padding: 15px;
      border-radius: 6px;
      text-align: center;
    }
    
    .stat-box .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 5px;
    }
    
    .stat-box .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .container {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 Forensic Profile Report</h1>
      <div class="timestamp">Generated: ${timestamp}</div>
    </div>
    
    <div class="content">
      <!-- Profile Overview -->
      <div class="section">
        <div class="profile-header">
          <img src="${snapshot.user.avatarUrl}" alt="Avatar" class="avatar" />
          <div class="profile-info">
            <h3>${snapshot.user.displayName}</h3>
            <div class="username">@${snapshot.user.username}</div>
            <div style="margin-top: 8px;">
              ${snapshot.user.isBanned ? '<span class="badge banned">BANNED</span>' : ''}
              <span class="badge">ID: ${snapshot.user.userId}</span>
            </div>
          </div>
        </div>
        
        <div class="label">Account Age:</div>
        <div class="value">${accountAge}</div>
        
        <div class="label" style="margin-top: 15px;">Created:</div>
        <div class="value">${new Date(snapshot.user.createdAt).toLocaleString()}</div>
      </div>

      <!-- Search Context -->
      <div class="section">
        <h2>Search Context</h2>
        <div class="label">Query Input:</div>
        <div class="value">${query.input}</div>
        <div class="label" style="margin-top: 10px;">Search Mode:</div>
        <div class="value">${query.mode}</div>
      </div>

      <!-- Bio & Description -->
      ${snapshot.user.description ? `
      <div class="section">
        <h2>Profile Bio</h2>
        <div class="value">${snapshot.user.description}</div>
      </div>
      ` : ''}

      <!-- Detected Flags & Mentions -->
      ${snapshot.profile && typeof snapshot.profile === 'object' && snapshot.profile !== null && (
        (Array.isArray(snapshot.profile.keywords) && snapshot.profile.keywords.length > 0) || 
        (Array.isArray(snapshot.profile.detectedMentions) && snapshot.profile.detectedMentions.length > 0)
      ) ? `
      <div class="section">
        <h2>Detected Flags & Mentions</h2>
        ${Array.isArray(snapshot.profile.keywords) && snapshot.profile.keywords.length > 0 ? `
          <div class="label">Keyword Flags:</div>
          <div class="value">
            ${snapshot.profile.keywords.map((kw: string) => `<span class="flag">${kw.replace('flag:', '')}</span>`).join(' ')}
          </div>
        ` : ''}
        ${Array.isArray(snapshot.profile.detectedMentions) && snapshot.profile.detectedMentions.length > 0 ? `
          <div class="label">External Mentions:</div>
          <div class="value">
            ${snapshot.profile.detectedMentions.map((m: string) => `<span class="flag">${m}</span>`).join(' ')}
          </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- Social Stats -->
      <div class="section">
        <h2>Social Statistics</h2>
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">${snapshot.counts.friends}</div>
            <div class="stat-label">Friends</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${snapshot.counts.followers}</div>
            <div class="stat-label">Followers</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${snapshot.counts.following}</div>
            <div class="stat-label">Following</div>
          </div>
        </div>
      </div>

      <!-- Groups -->
      ${snapshot.groups && snapshot.groups.length > 0 ? `
      <div class="section">
        <h2>Group Memberships (${snapshot.groups.length})</h2>
        ${snapshot.groups.map(group => `
          <div class="group-item">
            <div class="group-name">${group.name}</div>
            <div class="group-role">
              ${group.role} 
              ${group.isOwner ? '<span class="badge">OWNER</span>' : ''}
              <span class="badge ${group.riskTag}">${group.riskTag.toUpperCase()}</span>
            </div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- History -->
      ${(snapshot.history.pastDisplayNames && snapshot.history.pastDisplayNames.length > 0) || 
        (snapshot.history.pastUsernames && snapshot.history.pastUsernames.length > 0) ? `
      <div class="section">
        <h2>Name History</h2>
        ${snapshot.history.pastDisplayNames && snapshot.history.pastDisplayNames.length > 0 ? `
          <div class="label">Past Display Names:</div>
          <div class="value">${snapshot.history.pastDisplayNames.join(', ')}</div>
        ` : ''}
        ${snapshot.history.pastUsernames && snapshot.history.pastUsernames.length > 0 ? `
          <div class="label" style="margin-top: 10px;">Past Usernames:</div>
          <div class="value">${snapshot.history.pastUsernames.join(', ')}</div>
        ` : ''}
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <p>This report was generated by Roblox Verifier Tool</p>
      <p>Report ID: ${timestamp.replace(/[:.]/g, '-')}</p>
    </div>
  </div>
</body>
</html>
  `;
}

function calculateAccountAge(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) {
    return `${diffDays} days old`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} old`;
  } else {
    const years = Math.floor(diffDays / 365);
    const remainingMonths = Math.floor((diffDays % 365) / 30);
    return `${years} year${years > 1 ? 's' : ''} ${remainingMonths > 0 ? `${remainingMonths} month${remainingMonths > 1 ? 's' : ''}` : ''} old`;
  }
}
