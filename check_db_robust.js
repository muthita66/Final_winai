const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('Connecting to database...');
    try {
        const count = await prisma.teachers.count();
        console.log('Total teachers:', count);
        
        if (count > 0) {
            const t = await prisma.teachers.findFirst();
            console.log('First teacher:', t.first_name, t.last_name);
        }
    } catch (e) {
        console.error('DATABASE ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}

check().catch(console.error);
setTimeout(() => { console.log('Timeout hit - DB might be unreachable'); process.exit(1); }, 10000);
