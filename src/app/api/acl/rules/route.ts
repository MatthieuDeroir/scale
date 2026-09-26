import {
  addAccessRule,
  logActivity,
  parsePolicyFleets,
  parsePolicyRules,
  removeAccessRule,
  updatePolicy,
} from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function operator() {
  const session = await requireSession('OPERATOR');
  if (session.ok) return { session: session.session, error: null };
  return {
    session: null,
    error: NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    ),
  };
}

function respond(policy: string, updatedAt: string) {
  return NextResponse.json({ fleets: parsePolicyFleets(policy), ...parsePolicyRules(policy), raw: policy, updatedAt });
}

/** Autorise une flotte à en joindre une autre (sens unique). */
export async function POST(request: Request) {
  const { session, error } = await operator();
  if (error) return error;

  const body = (await request.json().catch(() => null)) as { from?: string; to?: string; ports?: string } | null;
  if (!body?.from || !body.to) {
    return NextResponse.json({ message: 'Source et destination requises' }, { status: 400 });
  }
  const input = { from: body.from, to: body.to, ports: body.ports ?? '*' };
  const result = await updatePolicy((raw) => addAccessRule(raw, input));
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });

  await logActivity({
    actor: session!.username,
    action: 'acl-rule-create',
    target: `${input.from} → ${input.to}:${input.ports || '*'}`,
  });
  return respond(result.policy, result.updatedAt);
}

/** Retire un accès ajouté, désigné par son empreinte (`?id=`). */
export async function DELETE(request: Request) {
  const { session, error } = await operator();
  if (error) return error;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ message: 'Règle requise' }, { status: 400 });
  const result = await updatePolicy((raw) => removeAccessRule(raw, id));
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });

  await logActivity({ actor: session!.username, action: 'acl-rule-delete', target: id });
  return respond(result.policy, result.updatedAt);
}
