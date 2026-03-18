const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const teachers = await prisma.teachers.findMany({
            select: { first_name: true, last_name: true }
        });
        console.log(`TOTAL_TEACHERS_COUNT: ${teachers.length}`);
        console.log('TEACHERS_LIST_START');
        teachers.forEach(t => console.log(`${t.first_name}|${t.last_name}`));
        console.log('TEACHERS_LIST_END');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
