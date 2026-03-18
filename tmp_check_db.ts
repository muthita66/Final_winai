import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const subjects = await prisma.subjects.findMany({
        include: {
            learning_subject_groups: true,
            subject_categories: true,
            teaching_assignments: {
                include: { classrooms: { include: { levels: true } } }
            }
        }
    });

    console.log('Total subjects:', subjects.length);
    subjects.forEach(s => {
        console.log(`- [${s.subject_code}] ${s.subject_name}`);
        console.log(`  Group: ${s.learning_subject_groups?.group_name}`);
        console.log(`  Category: ${s.subject_categories?.category_name}`);
        console.log(`  Assignments (levels): ${s.teaching_assignments.map(ta => ta.classrooms?.levels?.name).join(', ') || 'None'}`);
    });

    const groups = await prisma.learning_subject_groups.findMany();
    console.log('\nAll Learning Subject Groups:', groups.map(g => g.group_name).join(', '));

    const levels = await prisma.levels.findMany();
    console.log('All Levels:', levels.map(l => l.name).join(', '));

    const categories = await prisma.subject_categories.findMany();
    console.log('All Categories:', categories.map(c => c.category_name).join(', '));
}

main().catch(console.error).finally(() => prisma.$disconnect());
