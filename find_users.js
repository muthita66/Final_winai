
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const student = await prisma.students.findFirst({
            include: { users: true }
        });
        console.log('--- Student Test User ---');
        console.log('Username:', student?.users?.username);
        console.log('Student ID:', student?.id);

        const teacher = await prisma.teachers.findFirst({
            include: { users: true }
        });
        console.log('\n--- Teacher Test User ---');
        console.log('Username:', teacher?.users?.username);
        console.log('Teacher ID:', teacher?.id);

        const classroomAdvisor = await prisma.classroom_advisors.findFirst({
            where: { teacher_id: teacher?.id }
        });
        console.log('\n--- Classroom Advisor Mapping ---');
        console.log('Teacher ID:', teacher?.id, 'Classroom ID:', classroomAdvisor?.classroom_id);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
