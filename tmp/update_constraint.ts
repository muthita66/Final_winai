import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Updating events_visibility_check constraint...');
    
    // Drop the old constraint
    try {
        await prisma.$executeRaw`ALTER TABLE events DROP CONSTRAINT IF EXISTS events_visibility_check`;
        console.log('Old constraint dropped or did not exist.');
    } catch (e) {
        console.error('Error dropping constraint:', e.message);
    }

    // Add new constraint with all current target type codes
    try {
        await prisma.$executeRaw`
            ALTER TABLE events ADD CONSTRAINT events_visibility_check 
            CHECK (visibility = ANY (ARRAY['public', 'restricted', 'all', 'grade_level', 'classroom', 'teaching_assignment']));
        `;
        console.log('New constraint added successfully.');
    } catch (e) {
        console.error('Error adding new constraint:', e.message);
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
