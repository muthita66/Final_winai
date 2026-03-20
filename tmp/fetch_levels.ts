import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const levels = await prisma.levels.findMany();
    console.log(JSON.stringify(levels, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
