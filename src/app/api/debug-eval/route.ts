import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const categories = await prisma.evaluation_categories.findMany();
        const forms = await prisma.evaluation_forms.findMany({
            include: { evaluation_categories: true }
        });
        const sections = await prisma.evaluation_sections.findMany();
        
        return NextResponse.json({
            categories,
            forms,
            sectionsCount: sections.length
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
