const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const types = await prisma.evaluation_scale_types.findMany();
        const items = await prisma.evaluation_scale_items.findMany({
            orderBy: { order_number: 'asc' }
        });
        const forms = await prisma.evaluation_forms.findMany({
            where: { is_active: true },
            select: { id: true, form_name: true }
        });
        const questions = await prisma.evaluation_questions.findMany({
             select: { id: true, section_id: true, question_text: true, question_type: true, scale_type_id: true }
        });

        console.log('---START---');
        console.log(JSON.stringify({ types, items, forms, questions }, null, 2));
        console.log('---END---');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
