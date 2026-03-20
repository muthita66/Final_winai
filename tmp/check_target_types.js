const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const targetTypes = await prisma.target_types.findMany();
    console.log('Current target_types:', JSON.stringify(targetTypes, null, 2));

    const learningGroups = await prisma.learning_subject_groups.findMany({
        take: 5
    });
    console.log('Sample learning_subject_groups:', JSON.stringify(learningGroups, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
