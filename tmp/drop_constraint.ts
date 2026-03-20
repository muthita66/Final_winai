import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Dropping events_visibility_check constraint...');
    await prisma.$executeRaw`ALTER TABLE events DROP CONSTRAINT IF EXISTS events_visibility_check`;
    console.log('Constraint dropped.');
    
    const result = await prisma.$queryRaw`
        SELECT conname, pg_get_constraintdef(oid) 
        FROM pg_constraint 
        WHERE conrelid = 'events'::regclass AND conname = 'events_visibility_check';
    `;
    console.log('Remaining constraints with name events_visibility_check:', result);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
