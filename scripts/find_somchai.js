const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.teachers.count();
        console.log(`TOTAL_TEACHERS: ${count}`);

        const somchai = await prisma.teachers.findMany({
            where: {
                OR: [
                    { first_name: { contains: 'สมชาย' } },
                    { last_name: { contains: 'สมชาย' } }
                ]
            }
        });
        console.log('SOMCHAI_FOUND:', JSON.stringify(somchai, null, 2));

        const sample = await prisma.teachers.findMany({ take: 5 });
        console.log('SAMPLE_TEACHERS:', JSON.stringify(sample, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
