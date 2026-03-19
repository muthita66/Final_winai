import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const forms = await prisma.$queryRaw`SELECT id, form_name, is_active FROM evaluation_forms ORDER BY id`;
        const sections = await prisma.$queryRaw`SELECT id, form_id, section_name FROM evaluation_sections ORDER BY form_id, id LIMIT 20`;
        const questions = await prisma.$queryRaw`SELECT id, question_text, section_id FROM evaluation_questions LIMIT 10`;
        
        return NextResponse.json({
            forms: JSON.parse(JSON.stringify(forms, (_, v) => typeof v === 'bigint' ? Number(v) : v)),
            sections: JSON.parse(JSON.stringify(sections, (_, v) => typeof v === 'bigint' ? Number(v) : v)),
            questions: JSON.parse(JSON.stringify(questions, (_, v) => typeof v === 'bigint' ? Number(v) : v))
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
