import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const answersCols = await prisma.$queryRawUnsafe(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'evaluation_answers'
        `);
        const responsesCols = await prisma.$queryRawUnsafe(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'evaluation_responses'
        `);
        const tables = await prisma.$queryRawUnsafe(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name LIKE 'evaluation_%'
        `);

        return NextResponse.json({ answersCols, responsesCols, tables });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
