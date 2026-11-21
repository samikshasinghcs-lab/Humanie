import { NextRequest, NextResponse } from 'next/server';
import { processUnifiedIntake } from '@/lib/humanie-store';
import { ROLE_PERMISSION_MATRIX } from '@/lib/humanie-engine';
import { DomainType, IntakeChannel, UrgencyLevel, UserRole } from '@/lib/humanie-types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const roleHeader = (req.headers.get('x-humanie-role') || body.actorRole || 'NGO coordinator') as UserRole;
    const actorRole: UserRole = ROLE_PERMISSION_MATRIX[roleHeader] ? roleHeader : 'NGO coordinator';

    if (!ROLE_PERMISSION_MATRIX[actorRole].canCreateIntake) {
      return NextResponse.json(
        { error: `RBAC Denied: Role "${actorRole}" is not permitted to create intake records.` },
        { status: 403 }
      );
    }

    if (!body.consentGranted || body.consentGranted !== true) {
      return NextResponse.json({ error: 'Explicit service-participation consent is required; consentGranted must be true.' }, { status: 400 });
    }
    if (!['FOOD', 'WORK', 'EDUCATION'].includes(body.domain || 'FOOD')) return NextResponse.json({ error: 'Invalid domain.' }, { status: 400 });
    if (!['CRITICAL', 'HIGH', 'STANDARD'].includes(body.urgency || 'HIGH')) return NextResponse.json({ error: 'Invalid urgency.' }, { status: 400 });
    if (typeof (body.summaryNeed || 'Federated API intake submission.') !== 'string' || (body.summaryNeed || '').length > 2000) return NextResponse.json({ error: 'summaryNeed must be a string under 2000 characters.' }, { status: 400 });
    const res = processUnifiedIntake({
      actorRole,
      channel: (body.channel || 'API') as IntakeChannel,
      domain: (body.domain || 'FOOD') as DomainType,
      beneficiaryAlias: body.beneficiaryAlias || 'API Intake Applicant',
      urgency: (body.urgency || 'HIGH') as UrgencyLevel,
      summaryNeed: body.summaryNeed || 'Federated API intake submission.',
      constraints: body.constraints || {
        wardOrLocation: 'Ward 4 · Upland Canal Sector',
        transportAvailable: false,
        childcareRequired: false,
        preferredLanguage: 'Hindi / English',
        householdSize: 4,
      },
      consentGranted: true,
      dataSharingGranted: Boolean(body.dataSharingGranted),
      followUpGranted: Boolean(body.followUpGranted),
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({
      apiVersion: 'v1',
      pipeline: 'Channel -> Normalisation -> Validation -> Consent -> Case Creation -> Assignment -> Receipt',
      ...res,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Intake failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
