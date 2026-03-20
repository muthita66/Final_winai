import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Query for check constraints on the events table
    const result = await prisma.$queryRaw`
        SELECT conname, pg_get_constraintdef(oid) 
        FROM pg_constraint 
        WHERE conrelid = 'events'::regclass AND contype = 'c';
    `;
    console.log(JSON.stringify(result, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
