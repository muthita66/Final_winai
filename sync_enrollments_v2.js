const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const students = await prisma.students.findMany({ select: { id: true, classroom_id: true } });
    console.log('Total Students:', students.length);
    const classMap = new Map();
    students.forEach(s => {
        if (!classMap.has(s.classroom_id)) classMap.set(s.classroom_id, []);
        classMap.get(s.classroom_id).push(s.id);
    });
    console.log('Classroom Map:', Array.from(classMap.keys()));

    const assignments = await prisma.teaching_assignments.findMany({
        where: { classroom_id: { not: null } },
        select: { id: true, classroom_id: true }
    });
    console.log('Assignments with class:', assignments.length);

    let created = 0;
    for (const a of assignments) {
        const studentIds = classMap.get(a.classroom_id) || [];
        if (studentIds.length > 0) {
            // console.log(`Assignment ${a.id} (Class ${a.classroom_id}): Found ${studentIds.length} students`);
            for (const sId of studentIds) {
                try {
                    await prisma.enrollments.upsert({
                        where: {
                            student_id_teaching_assignment_id: {
                                student_id: sId,
                                teaching_assignment_id: a.id
                            }
                        },
                        update: {},
                        create: {
                            student_id: sId,
                            teaching_assignment_id: a.id,
                            status: 'enrolled'
                        }
                    });
                    created++;
                } catch (e) {
                    // console.error(e.message);
                }
            }
        }
    }
    console.log('Final Created/Updated:', created);
}

main().finally(() => prisma.$disconnect());
