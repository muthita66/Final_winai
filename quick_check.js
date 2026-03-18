const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Quick Check ---');
    const t = setTimeout(() => { console.log('Timeout'); process.exit(1); }, 10000);
    try {
        const subjects = await prisma.$queryRaw`SELECT s.id, s.subject_name, s.level, g.group_name 
            FROM subjects s 
            LEFT JOIN learning_subject_groups g ON s.learning_subject_group_id = g.id 
            LIMIT 5`;
        console.log('Subjects:', subjects);
        
        const levels = await prisma.$queryRaw`SELECT name FROM levels LIMIT 5`;
        console.log('Levels:', levels);

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        clearTimeout(t);
        await prisma.$disconnect();
    }
}

main();
