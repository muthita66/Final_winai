import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const lastId = await prisma.$queryRaw`SELECT MAX(id) FROM event_targets`;
        const seqVal = await prisma.$queryRaw`SELECT nextval('event_targets_id_seq')`;
        console.log('Last ID in event_targets:', lastId);
        console.log('Next value from sequence:', seqVal);

        // Reset sequence to max id + 1
        await prisma.$executeRaw`SELECT setval('event_targets_id_seq', (SELECT MAX(id) FROM event_targets))`;
        console.log('Sequence reset to MAX(id)');
    } catch (e) {
        console.error('Error:', e.message);
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
