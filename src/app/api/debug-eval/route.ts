import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const res1 = await prisma.$executeRawUnsafe(`
            SELECT setval('evaluation_responses_id_seq', coalesce((SELECT MAX(id) FROM evaluation_responses), 0) + 1, false);
        `);
        
        const res2 = await prisma.$executeRawUnsafe(`
            SELECT setval('evaluation_answers_id_seq', coalesce((SELECT MAX(id) FROM evaluation_answers), 0) + 1, false);
        `);
        
        return NextResponse.json({ 
            success: true, 
            message: "Sequences for evaluation_responses and evaluation_answers fixed successfully",
            res1, res2
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message });
    }
}
