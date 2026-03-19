const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const q = await prisma.evaluation_questions.findFirst({
            where: {
                question_text: {
                    contains: 'เชิญร่วมแสดงความคิดเห็น'
                }
            }
        });
        console.log(JSON.stringify(q, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
