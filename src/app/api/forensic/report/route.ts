// FILE: src/app/api/forensic/report/route.ts
// Forensic Mode - Report generation API

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  createForensicReport,
  filterSnapshotFields,
  generateReportHTML,
  type FieldSelector,
} from '@/app/lib/forensic';

interface RequestBody {
  snapshot: any;
  query: { input: string; mode: 'userId' | 'username' | 'displayName' };
  caseId?: string;
  fieldSelector?: FieldSelector;
  format: 'json' | 'pdf';
}

export async function POST(request: Request) {
  try {
    // Get authenticated user
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RequestBody = await request.json();
    const { snapshot, query, caseId, fieldSelector, format } = body;

    if (!snapshot || !query) {
      return NextResponse.json(
        { error: 'Missing required fields: snapshot, query' },
        { status: 400 }
      );
    }

    // Filter snapshot based on field selector
    const filteredSnapshot = fieldSelector
      ? filterSnapshotFields(snapshot, fieldSelector)
      : snapshot;

    // Create forensic report with hash
    const report = await createForensicReport(
      filteredSnapshot,
      query,
      { email: session.user.email || undefined, name: session.user.name || undefined },
      caseId
    );

    // TODO: Save audit log to database
    // await saveAuditLog({
    //   reportId: report.meta.reportId,
    //   userId: session.user.email,
    //   query,
    //   hash: report.hash.value,
    //   caseId,
    //   createdAt: report.meta.createdAt,
    // });

    if (format === 'json') {
      return NextResponse.json(report);
    } else {
      // Generate HTML for PDF
      const html = generateReportHTML(report);
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `inline; filename="forensic-report-${report.meta.reportId}.html"`,
        },
      });
    }
  } catch (error) {
    console.error('Forensic report generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate forensic report' },
      { status: 500 }
    );
  }
}
