const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const studentGroups = await prisma.students.groupBy({
        by: ['classroom_id'],
        _count: { id: true }
    });

    const assignmentGroups = await prisma.teaching_assignments.groupBy({
        by: ['classroom_id'],
        _count: { id: true }
    });

    const studentClassIds = studentGroups.map(g => g.classroom_id).filter(id => id !== null);
    const assignmentClassIds = assignmentGroups.map(g => g.classroom_id).filter(id => id !== null);

    console.log('Student Classroom IDs:', studentClassIds);
    console.log('Assignment Classroom IDs:', assignmentClassIds);

    const overlap = studentClassIds.filter(id => assignmentClassIds.includes(id));
    console.log('Overlap IDs:', overlap);

    if (overlap.length === 0) {
        console.log('\n[CRITICAL] ZERO overlap between student classrooms and assignment classrooms!');

        // Check classroom names for potential manual matching
        const studentClasses = await prisma.classrooms.findMany({
            where: { id: { in: studentClassIds } },
            select: { id: true, room_name: true }
        });
        const assignmentClasses = await prisma.classrooms.findMany({
            where: { id: { in: assignmentClassIds } },
            select: { id: true, room_name: true }
        });

        console.log('\nStudent Class Names:', studentClasses);
        console.log('\nAssignment Class Names (First 10):', assignmentClasses.slice(0, 10));
    }
}

main().finally(() => prisma.$disconnect());
