
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const days = await prisma.day_of_weeks.findMany();
        console.log('DAYS_DATA_START');
        console.log(JSON.stringify(days));
        console.log('DAYS_DATA_END');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
