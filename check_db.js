const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.subjects.count();
        console.log('Total subjects count:', count);

        if (count > 0) {
            const sample = await prisma.subjects.findMany({
                take: 5,
                include: {
                    learning_subject_groups: true,
                    subject_categories: true,
                    teaching_assignments: {
                        include: { classrooms: { include: { levels: true } } }
                    }
                }
            });
            console.log('Sample subjects:', JSON.stringify(sample, null, 2));
        }

        const groups = await prisma.learning_subject_groups.findMany();
        console.log('Groups:', groups.map(g => g.group_name));

        const categories = await prisma.subject_categories.findMany();
        console.log('Categories:', categories.map(c => c.category_name));

        const levels = await prisma.levels.findMany();
        console.log('Levels:', levels.map(l => l.name));

    } catch (e) {
        console.error('Error querying DB:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
