import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const cols = await prisma.$queryRaw`
        SELECT column_name, data_type, ordinal_position
        FROM information_schema.columns
        WHERE table_name = 'events'
        ORDER BY ordinal_position;
    `;
    console.log(JSON.stringify(cols, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
