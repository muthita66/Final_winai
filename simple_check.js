
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const categories = await prisma.evaluation_categories.findMany({
            select: { id: true, name: true, engine_type: true }
        });
        console.log('CATEGORIES:', JSON.stringify(categories));
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
