const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
    try {
        const teachers = await prisma.teachers.findMany({
            select: { first_name: true, last_name: true }
        });
        const output = teachers.map(t => `${t.first_name} ${t.last_name}`).join('\n');
        fs.writeFileSync('teacher_list.txt', output);
        console.log('Done');
    } catch (e) {
        fs.writeFileSync('teacher_error.txt', e.stack);
    } finally {
        await prisma.$disconnect();
    }
}

main();
