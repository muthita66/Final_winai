const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const studentWithClass = await prisma.students.findFirst({
        where: { classroom_id: { not: null } },
        include: { classrooms: true }
    });

    console.log('--- STUDENT SAMPLE ---');
    console.log('Student ID:', studentWithClass?.id);
    console.log('Classroom ID:', studentWithClass?.classroom_id);
    console.log('Classroom Name:', studentWithClass?.classrooms?.room_name);

    const assignmentWithClass = await prisma.teaching_assignments.findFirst({
        where: { classroom_id: { not: null } },
        include: { classrooms: true }
    });

    console.log('\n--- ASSIGNMENT SAMPLE ---');
    console.log('Assignment ID:', assignmentWithClass?.id);
    console.log('Classroom ID:', assignmentWithClass?.classroom_id);
    console.log('Classroom Name:', assignmentWithClass?.classrooms?.room_name);

    // Count distinct classroom IDs in each table
    const studentClassIds = await prisma.students.groupBy({
        by: ['classroom_id'],
        _count: { classroom_id: true }
    });

    const assignmentClassIds = await prisma.teaching_assignments.groupBy({
        by: ['classroom_id'],
        _count: { classroom_id: true }
    });

    console.log('\nDistinct Classroom IDs in Students:', studentClassIds.length);
    console.log('Distinct Classroom IDs in Assignments:', assignmentClassIds.length);

    console.log('\nSample Student Class IDs:', studentClassIds.slice(0, 5).map(c => c.classroom_id));
    console.log('Sample Assignment Class IDs:', assignmentClassIds.slice(0, 5).map(c => c.classroom_id));
}

main().finally(() => prisma.$disconnect());
