// FILE: src/app/lib/forensic.ts
// Forensic Mode - Evidence generation and hashing utilities

export interface ForensicReport {
  meta: {
    reportId: string;
    createdAt: string;
    createdBy: string;
    appVersion: string;
    forensicMode: boolean;
    caseId?: string;
  };
  query: {
    input: string;
    mode: 'userId' | 'username' | 'displayName';
  };
  sources: Array<{
    name: string;
    fetchedAt: string;
  }>;
  snapshot: Record<string, unknown>;
  hash: {
    algo: string;
    value: string;
  };
  chainOfCustody: Array<{
    event: string;
    actor: string;
    at: string;
  }>;
}

export interface FieldSelector {
  user: boolean;
  counts: boolean;
  profile: boolean;
  groups: boolean;
  history: boolean;
}

export const DEFAULT_FIELD_SELECTOR: FieldSelector = {
  user: true,
  counts: true,
  profile: true,
  groups: true,
  history: true,
};

/**
 * Generate SHA-256 hash of data snapshot
 */
export async function generateHash(data: Record<string, unknown>): Promise<string> {
  const normalized = JSON.stringify(data, Object.keys(data).sort());
  const msgBuffer = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Create forensic report with evidence snapshot
 */
export async function createForensicReport(
  snapshot: Record<string, unknown>,
  query: { input: string; mode: 'userId' | 'username' | 'displayName' },
  user: { email?: string; name?: string },
  caseId?: string
): Promise<ForensicReport> {
  const reportId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const hash = await generateHash(snapshot);

  const report: ForensicReport = {
    meta: {
      reportId,
      createdAt,
      createdBy: user.email || user.name || 'unknown',
      appVersion: '1.0.0',
      forensicMode: true,
      caseId,
    },
    query,
    sources: [
      { name: 'roblox.users', fetchedAt: createdAt },
      { name: 'roblox.groups', fetchedAt: createdAt },
      { name: 'roblox.friends', fetchedAt: createdAt },
    ],
    snapshot,
    hash: {
      algo: 'SHA-256',
      value: hash,
    },
    chainOfCustody: [
      {
        event: 'generated',
        actor: user.email || user.name || 'unknown',
        at: createdAt,
      },
    ],
  };

  return report;
}

/**
 * Filter snapshot data based on field selector
 */
export function filterSnapshotFields(snapshot: Record<string, unknown>, selector: FieldSelector): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};

  if (selector.user && snapshot.user) {
    filtered.user = snapshot.user;
  }
  if (selector.counts && snapshot.counts) {
    filtered.counts = snapshot.counts;
  }
  if (selector.profile && snapshot.profile) {
    filtered.profile = snapshot.profile;
  }
  if (selector.groups && snapshot.groups) {
    filtered.groups = snapshot.groups;
  }
  if (selector.history && snapshot.history) {
    filtered.history = snapshot.history;
  }

  return filtered;
}

/**
 * Add chain of custody event
 */
export function addCustodyEvent(
  report: ForensicReport,
  event: string,
  actor: string
): ForensicReport {
  return {
    ...report,
    chainOfCustody: [
      ...report.chainOfCustody,
      {
        event,
        actor,
        at: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Verify report integrity by checking hash
 */
export async function verifyReportIntegrity(report: ForensicReport): Promise<boolean> {
  const computedHash = await generateHash(report.snapshot);
  return computedHash === report.hash.value;
}

interface GroupData {
  name: string;
  role: string;
  isOwner: boolean;
  riskTag: string;
}

/**
 * Generate PDF-friendly HTML for forensic report
 */
export function generateReportHTML(report: ForensicReport): string {
  const snapshot = report.snapshot;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Forensic Report ${report.meta.reportId}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
    .section { margin: 30px 0; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; }
    .label { font-weight: bold; color: #555; margin-top: 10px; }
    .value { margin-left: 20px; color: #333; }
    .hash { font-family: monospace; font-size: 12px; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px; }
    .chain { border-left: 3px solid #667eea; padding-left: 15px; margin: 10px 0; }
    .timestamp { color: #888; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; font-weight: bold; }
    .flag { display: inline-block; padding: 4px 8px; background: #ffd700; border-radius: 4px; margin: 2px; font-size: 12px; }
    .watermark { position: fixed; bottom: 20px; right: 20px; opacity: 0.1; font-size: 100px; transform: rotate(-45deg); }
  </style>
</head>
<body>
  <div class="watermark">FORENSIC</div>

  <div class="header">
    <h1>🔒 Forensic Evidence Report</h1>
    <p>Report ID: ${report.meta.reportId}</p>
    <p>Generated: ${new Date(report.meta.createdAt).toLocaleString()}</p>
  </div>

  <div class="section">
    <h2>Report Metadata</h2>
    <div class="label">Created By:</div>
    <div class="value">${report.meta.createdBy}</div>
    <div class="label">Timestamp (UTC):</div>
    <div class="value">${report.meta.createdAt}</div>
    <div class="label">App Version:</div>
    <div class="value">${report.meta.appVersion}</div>
    ${report.meta.caseId ? `
    <div class="label">Case ID:</div>
    <div class="value">${report.meta.caseId}</div>
    ` : ''}
  </div>

  <div class="section">
    <h2>Query Information</h2>
    <div class="label">Search Input:</div>
    <div class="value">${report.query.input}</div>
    <div class="label">Search Mode:</div>
    <div class="value">${report.query.mode}</div>
  </div>

  <div class="section">
    <h2>User Profile Snapshot</h2>
    ${snapshot.user && typeof snapshot.user === 'object' && snapshot.user !== null ? `
      <div class="label">Username:</div>
      <div class="value">@${(snapshot.user as Record<string, unknown>).username || 'N/A'}</div>
      <div class="label">Display Name:</div>
      <div class="value">${(snapshot.user as Record<string, unknown>).displayName || 'N/A'}</div>
      <div class="label">User ID:</div>
      <div class="value">${(snapshot.user as Record<string, unknown>).userId || 'N/A'}</div>
      <div class="label">Account Created:</div>
      <div class="value">${(snapshot.user as Record<string, unknown>).createdAt ? new Date((snapshot.user as Record<string, unknown>).createdAt as string).toLocaleDateString() : 'N/A'}</div>
      <div class="label">Description:</div>
      <div class="value">${(snapshot.user as Record<string, unknown>).description || 'None'}</div>
      ${(snapshot.user as Record<string, unknown>).isBanned ? '<div class="value" style="color: red; font-weight: bold;">⚠️ ACCOUNT BANNED</div>' : ''}
    ` : '<p>User data not available</p>'}
  </div>

  ${snapshot.counts && typeof snapshot.counts === 'object' && snapshot.counts !== null ? `
  <div class="section">
    <h2>Social Metrics</h2>
    <table>
      <tr><th>Metric</th><th>Count</th></tr>
      <tr><td>Friends</td><td>${(snapshot.counts as Record<string, unknown>).friends || 'N/A'}</td></tr>
      <tr><td>Followers</td><td>${(snapshot.counts as Record<string, unknown>).followers || 'N/A'}</td></tr>
      <tr><td>Following</td><td>${(snapshot.counts as Record<string, unknown>).following || 'N/A'}</td></tr>
    </table>
  </div>
  ` : ''}

  ${snapshot.groups && Array.isArray(snapshot.groups) && snapshot.groups.length > 0 ? `
  <div class="section">
    <h2>Group Memberships</h2>
    <table>
      <tr><th>Group Name</th><th>Role</th><th>Risk</th></tr>
      ${(snapshot.groups as GroupData[]).map((g: GroupData) => `
        <tr>
          <td>${g.name}</td>
          <td>${g.role} ${g.isOwner ? '(Owner)' : ''}</td>
          <td><span style="color: ${g.riskTag === 'high' ? 'red' : g.riskTag === 'med' ? 'orange' : 'green'}">${g.riskTag.toUpperCase()}</span></td>
        </tr>
      `).join('')}
    </table>
  </div>
  ` : ''}

  ${(() => {
    const profile = snapshot.profile as Record<string, unknown> | null | undefined;
    if (!profile || typeof profile !== 'object') return '';
    
    const keywords = profile.keywords;
    const detectedMentions = profile.detectedMentions;
    const hasKeywords = Array.isArray(keywords) && keywords.length > 0;
    const hasMentions = Array.isArray(detectedMentions) && detectedMentions.length > 0;
    
    if (!hasKeywords && !hasMentions) return '';
    
    return `
  <div class="section">
    <h2>Detected Flags & Mentions</h2>
    ${hasKeywords ? `
      <div class="label">Keyword Flags:</div>
      <div class="value">
        ${(keywords as string[]).map((kw: string) => `<span class="flag">${kw.replace('flag:', '')}</span>`).join(' ')}
      </div>
    ` : ''}
    ${hasMentions ? `
      <div class="label">External Mentions:</div>
      <div class="value">
        ${(detectedMentions as string[]).map((m: string) => `<span class="flag">${m}</span>`).join(' ')}
      </div>
    ` : ''}
  </div>
    `;
  })()}

  <div class="section">
    <h2>Data Sources</h2>
    ${report.sources.map(s => `
      <div class="chain">
        <strong>${s.name}</strong><br>
        <span class="timestamp">Fetched: ${new Date(s.fetchedAt).toLocaleString()}</span>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <h2>Cryptographic Hash</h2>
    <div class="label">Algorithm:</div>
    <div class="value">${report.hash.algo}</div>
    <div class="label">Hash Value:</div>
    <div class="hash">${report.hash.value}</div>
    <p style="font-size: 12px; color: #666; margin-top: 10px;">
      This hash ensures data integrity. Any modification to the snapshot will result in a different hash.
    </p>
  </div>

  <div class="section">
    <h2>Chain of Custody</h2>
    ${report.chainOfCustody.map((event, idx) => `
      <div class="chain">
        <strong>Event #${idx + 1}: ${event.event}</strong><br>
        Actor: ${event.actor}<br>
        <span class="timestamp">${new Date(event.at).toLocaleString()}</span>
      </div>
    `).join('')}
  </div>

  <div class="section" style="background: #f9f9f9; border: 2px solid #667eea;">
    <h3 style="color: #667eea;">Legal Notice</h3>
    <p style="font-size: 12px; color: #555;">
      This forensic report was generated by Roblox Verifier Tool v${report.meta.appVersion}.
      The data contained herein represents a timestamped snapshot of publicly available information
      from Roblox APIs at the time of generation. This report should be treated as evidence and
      stored in accordance with your organization's data retention policies.
    </p>
  </div>

  <div style="text-align: center; margin-top: 40px; padding: 20px; border-top: 2px solid #e0e0e0;">
    <p style="color: #888; font-size: 12px;">
      Report generated by Roblox Verifier Tool • ${new Date(report.meta.createdAt).toLocaleString()}
    </p>
  </div>
</body>
</html>
  `;
}