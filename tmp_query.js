const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    try {
        const departments = await prisma.departments.findMany();
        console.log('--- DEPARTMENTS ---');
        console.log(JSON.stringify(departments, null, 2));
        const positions = await prisma.teacher_positions.findMany();
        console.log('--- POSITIONS ---');
        console.log(JSON.stringify(positions, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}
main();
