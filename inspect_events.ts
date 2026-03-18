
import { prisma } from './src/lib/prisma';

async function test() {
    try {
        const columns = await prisma.$queryRaw`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'events'
        `;
        console.log('Events Columns:');
        console.log(JSON.stringify(columns, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
