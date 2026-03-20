import { prisma } from '../src/lib/prisma';

async function main() {
    try {
        const ev = await prisma.events.findUnique({ where: { id: 1 } });
        console.log('Current event id 1:', JSON.stringify(ev, null, 2));
        
        console.log('Attempting to update visibility of event 1 to "grade_level"...');
        const updated = await prisma.events.update({
            where: { id: 1 },
            data: { visibility: 'grade_level' }
        });
        console.log('Update result:', JSON.stringify(updated, null, 2));
        console.log('Update SUCCESS');
    } catch (e) {
        console.error('Update FAILED:', e.message);
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
