
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- evaluation_questions columns ---');
        const columns = await prisma.$queryRaw`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'evaluation_questions'
        `;
        console.log(JSON.stringify(columns, null, 2));

        console.log('\n--- evaluation_forms columns ---');
        const formColumns = await prisma.$queryRaw`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'evaluation_forms'
        `;
        console.log(JSON.stringify(formColumns, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
