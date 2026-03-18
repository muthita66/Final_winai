
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const levels = await prisma.grade_levels.findMany();
        console.log('Grade Levels:', levels);

        const classrooms = await prisma.classrooms.findMany({
            include: { grade_levels: true }
        });
        console.log('Classrooms:', classrooms.length);
        if (classrooms.length > 0) {
            console.log('Sample Classroom:', classrooms[0]);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
