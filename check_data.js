
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const data = await prisma.evaluation_responses.findMany({
            take: 5
        });
        console.log('Sample data from evaluation_responses:');
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
