const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- DB Check ---');
        const subjects = await prisma.subjects.findMany({
            take: 5,
            include: {
                learning_subject_groups: true,
                teaching_assignments: {
                    include: { classrooms: { include: { levels: true } } },
                    take: 1
                }
            }
        });
        console.log('Subjects Sample:', JSON.stringify(subjects, null, 2));

        const groups = await prisma.learning_subject_groups.findMany();
        console.log('Groups:', groups.map(g => `|${g.group_name}|`));

        const levels = await prisma.levels.findMany();
        console.log('Levels:', levels.map(l => `|${l.name}|`));
        
        // Check if level column exists in subjects
        const columnCheck = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'level'`;
        console.log('Level column in subjects:', columnCheck);

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
