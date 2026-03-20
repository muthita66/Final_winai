import { prisma } from './src/lib/prisma';

async function check() {
    try {
        const count = await prisma.teachers.count();
        console.log('Total teachers:', count);
        
        const examples = await prisma.teachers.findMany({
            take: 5,
            include: {
                name_prefixes: true,
            }
        });
        console.log('Examples:', JSON.stringify(examples, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
