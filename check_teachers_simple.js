const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const count = await prisma.teachers.count();
        console.log('Total teachers:', count);
        
        const examples = await prisma.teachers.findMany({
            take: 10,
            include: {
                name_prefixes: true,
            }
        });
        console.log('Examples:');
        examples.forEach(t => {
            console.log(`- ID: ${t.id}, Code: ${t.teacher_code}, Name: ${t.name_prefixes?.prefix_name || ''}${t.first_name || ''} ${t.last_name || ''}`);
        });
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
