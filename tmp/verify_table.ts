import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const gradeLevels = await prisma.$queryRaw`SELECT * FROM grade_levels LIMIT 1`;
        console.log("grade_levels exists");
    } catch (e) {
        console.log("grade_levels does NOT exist");
    }

    try {
        const levels = await prisma.$queryRaw`SELECT * FROM levels LIMIT 1`;
        console.log("levels exists");
    } catch (e) {
        console.log("levels does NOT exist");
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
