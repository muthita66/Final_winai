const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log(await prisma.events.findFirst({ orderBy: { id: 'desc' } }));
}

main().catch(console.error).finally(() => prisma.$disconnect());
