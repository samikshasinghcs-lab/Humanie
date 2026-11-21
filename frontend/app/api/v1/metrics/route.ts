import { NextResponse } from 'next/server';
import { executeBatch2Operation } from '@/lib/humanie-store';
export async function GET() { return NextResponse.json({ apiVersion:'v1', metrics: executeBatch2Operation({action:'domain_metrics',payload:{}}) }); }
