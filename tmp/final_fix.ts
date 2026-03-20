import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Final attempt to drop and re-add constraint...');
    
    // Drop all possible names just in case
    await prisma.$executeRaw`ALTER TABLE events DROP CONSTRAINT IF EXISTS events_visibility_check`;
    await prisma.$executeRaw`ALTER TABLE events DROP CONSTRAINT IF EXISTS visibility_check`;
    
    // Add it back with ALL target type codes
    const targetTypes: any[] = await prisma.$queryRaw`SELECT code FROM target_types`;
    const codes = targetTypes.map(t => t.code);
    const allAllowed = [...new Set(['public', 'restricted', ...codes])];
    
    const arrayStr = allAllowed.map(c => `'${c}'`).join(', ');
    const query = `ALTER TABLE events ADD CONSTRAINT events_visibility_check CHECK (visibility = ANY (ARRAY[${arrayStr}]::text[]))`;
    console.log('Running query:', query);
    
    await prisma.$executeRawUnsafe(query);
    console.log('Constraint re-added successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
