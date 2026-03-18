const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const directorUser = await prisma.users.findFirst({
        where: { roles: { role_name: { contains: 'director', mode: 'insensitive' } } },
        select: { username: true }
    });

    const teacherUser = await prisma.users.findFirst({
        where: { roles: { role_name: { contains: 'teacher', mode: 'insensitive' } } },
        include: { teachers: true }
    });

    const studentUser = await prisma.users.findFirst({
        where: { roles: { role_name: { contains: 'student', mode: 'insensitive' } } },
        include: { students: true }
    });

    console.log('--- TEST CREDENTIALS ---');
    console.log('Director:', directorUser?.username || 'None');
    console.log('Teacher:', teacherUser?.username || 'None', teacherUser?.teachers ? `(Code: ${teacherUser.teachers.teacher_code})` : '');
    console.log('Student:', studentUser?.username || 'None', studentUser?.students ? `(Code: ${studentUser.students.student_code})` : '');
    console.log('Password (Default): 1234');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
