
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const teacher = await prisma.teachers.findFirst({
            where: { teacher_code: 'T001' }
        });
        console.log('--- Teacher T001 ---');
        console.log(JSON.stringify(teacher, null, 2));

        if (teacher) {
            const assignments = await prisma.teaching_assignments.findMany({
                where: { teacher_id: teacher.id },
                include: {
                    subjects: { select: { subject_code: true, subject_name: true } },
                    semesters: { include: { academic_years: true } }
                }
            });
            console.log('--- ALL Assignments for T001 (No filter) ---');
            console.log(JSON.stringify(assignments, null, 2));

            const years = await prisma.academic_years.findMany();
            console.log('--- All Academic Years ---');
            console.log(JSON.stringify(years, null, 2));
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
