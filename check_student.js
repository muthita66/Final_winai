const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find a student with grades
    const studentWithGrades = await prisma.grades.findFirst({
        select: { student_id: true }
    });

    if (!studentWithGrades) {
        console.log('No students with grades found');
        return;
    }

    const studentId = studentWithGrades.student_id;
    console.log('Checking data for student ID:', studentId);

    const regs = await prisma.registrations.findMany({
        where: { student_id: studentId },
        include: { subject_sections: true }
    });

    console.log(`Found ${regs.length} registrations for student ${studentId}`);
    regs.forEach(r => {
        console.log(`- Section ${r.section_id}: Year ${r.subject_sections?.year}, Sem ${r.subject_sections?.semester}, Status ${r.status}`);
    });

    const grades = await prisma.grades.findMany({
        where: { student_id: studentId }
    });
    console.log(`Found ${grades.length} grades for student ${studentId}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
