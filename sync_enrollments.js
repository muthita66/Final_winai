const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- STARTING ENROLLMENT SYNC ---');

    // Get all teaching assignments that have a classroom
    const assignments = await prisma.teaching_assignments.findMany({
        where: { classroom_id: { not: null } }
    });

    console.log(`Found ${assignments.length} teaching assignments with classroom IDs.`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const assignment of assignments) {
        // Find students in this classroom
        const students = await prisma.students.findMany({
            where: { classroom_id: assignment.classroom_id }
        });

        for (const student of students) {
            // Check if enrollment already exists
            const existing = await prisma.enrollments.findUnique({
                where: {
                    student_id_teaching_assignment_id: {
                        student_id: student.id,
                        teaching_assignment_id: assignment.id
                    }
                }
            });

            if (!existing) {
                await prisma.enrollments.create({
                    data: {
                        student_id: student.id,
                        teaching_assignment_id: assignment.id,
                        status: 'enrolled'
                    }
                });
                createdCount++;
            } else {
                skippedCount++;
            }
        }
    }

    console.log(`Synchronization finished.`);
    console.log(`Created: ${createdCount} enrollments.`);
    console.log(`Skipped (already exist): ${skippedCount} enrollments.`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
