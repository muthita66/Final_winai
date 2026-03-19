
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- evaluation_categories ---');
        const categories = await prisma.evaluation_categories.findMany();
        console.log(JSON.stringify(categories, null, 2));

        console.log('\n--- evaluation_forms ---');
        const forms = await prisma.evaluation_forms.findMany({
            include: { evaluation_categories: true }
        });
        console.log(JSON.stringify(forms, null, 2));

        console.log('\n--- Sample evaluation_questions (last 10) ---');
        const questions = await prisma.evaluation_questions.findMany({
            take: 10,
            orderBy: { id: 'desc' }
        });
        console.log(JSON.stringify(questions, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
