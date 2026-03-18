const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const enrollmentsCount = await prisma.enrollments.count();
    const studentsCount = await prisma.students.count();
    const teachersCount = await prisma.teachers.count();
    const assignmentsCount = await prisma.teaching_assignments.count();

    console.log('--- DB STATS ---');
    console.log('Enrollments:', enrollmentsCount);
    console.log('Students:', studentsCount);
    console.log('Teachers:', teachersCount);
    console.log('Teaching Assignments:', assignmentsCount);

    if (enrollmentsCount === 0 && assignmentsCount > 0) {
        console.log('\n[WARNING] Enrollments table is empty but teaching assignments exist.');
    }

    // Check a sample teacher assignment to see if it has students in the classroom
    const sampleAssignment = await prisma.teaching_assignments.findFirst({
        where: { classroom_id: { not: null } },
        include: { classrooms: true }
    });

    if (sampleAssignment) {
        const studentCountInClass = await prisma.students.count({
            where: { classroom_id: sampleAssignment.classroom_id }
        });
        console.log('\n[SAMPLE] Assignment ID:', sampleAssignment.id, 'Classroom:', sampleAssignment.classrooms?.room_name);
        console.log('Students in this classroom:', studentCountInClass);
    }
}

main().finally(() => prisma.$disconnect());
