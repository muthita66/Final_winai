const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Database Diagnostic ---');
        
        // Check Learning Subject Groups
        const groups = await prisma.learning_subject_groups.findMany();
        console.log('Subject Groups:', groups.map(g => `[${g.id}] ${g.group_name}`));

        // Check Subject Categories
        const categories = await prisma.subject_categories.findMany();
        console.log('Categories:', categories.map(c => `[${c.id}] ${c.category_name}`));

        // Check Levels
        const levels = await prisma.levels.findMany();
        console.log('Levels:', levels.map(l => `[${l.id}] ${l.name}`));

        // Check Subjects count
        const subjectsCount = await prisma.subjects.count();
        console.log('Total Subjects:', subjectsCount);

        // Check subjects with certain group/category
        const matchingSubjects = await prisma.subjects.findMany({
            where: {
                learning_subject_groups: {
                    group_name: { contains: 'ไทย', mode: 'insensitive' }
                }
            },
            include: {
                learning_subject_groups: true,
                subject_categories: true,
                teaching_assignments: {
                    include: { classrooms: { include: { levels: true } } }
                }
            }
        });

        console.log('Matching Subjects (Thai):', matchingSubjects.length);
        matchingSubjects.forEach(s => {
            console.log(`- [${s.subject_code}] ${s.subject_name}`);
            console.log(`  Group: ${s.learning_subject_groups?.group_name}`);
            console.log(`  Category: ${s.subject_categories?.category_name}`);
            const assignedLevels = s.teaching_assignments.map(ta => ta.classrooms?.levels?.name).filter(Boolean);
            console.log(`  Assigned Levels: ${assignedLevels.join(', ') || 'None'}`);
        });

    } catch (e) {
        console.error('Diagnostic error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
