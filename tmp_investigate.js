const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const forms = await prisma.evaluation_forms.findMany({
            where: { id: { in: [2, 3] } },
            include: {
                evaluation_categories: true,
                evaluation_sections: {
                    include: {
                        evaluation_questions: true
                    }
                }
            }
        });

        fs.writeFileSync('investigate_output.json', JSON.stringify(forms, null, 2));
    } catch (e) {
        fs.writeFileSync('investigate_output.json', JSON.stringify({ error: e.message }));
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
