const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
    try {
        const questions = await prisma.$queryRaw`
            SELECT id, question_text, question_type, scale_type_id, section_id 
            FROM evaluation_questions
        `;
        const scaleItems = await prisma.$queryRaw`
            SELECT scale_type_id, label, score_value, order_number 
            FROM evaluation_scale_items
        `;
        const result = { questions, scaleItems };
        fs.writeFileSync('db_audit_result.json', JSON.stringify(result, null, 2));
        console.log('DONE');
    } catch (e) {
        fs.writeFileSync('db_audit_error.txt', e.toString());
    } finally {
        await prisma.$disconnect();
    }
}

main();
