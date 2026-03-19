import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("=== Forms ===");
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

    console.log(JSON.stringify(forms, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
