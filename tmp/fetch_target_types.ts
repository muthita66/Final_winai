import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const targetTypes = await prisma.target_types.findMany();
    console.log(JSON.stringify(targetTypes, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
