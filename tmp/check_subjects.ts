import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const subjects = await prisma.subjects.findMany({
        select: {
            id: true,
            subject_code: true,
            subject_name: true,
            subject_categories_id: true,
            subject_categories: { select: { category_name: true } },
        },
        orderBy: { subject_code: 'asc' },
    });
    console.log('=== Subjects ===');
    subjects.forEach(s => {
        console.log(`[${s.id}] ${s.subject_code} - ${s.subject_name} | cat: ${s.subject_categories?.category_name ?? 'null'} (id=${s.subject_categories_id})`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
