const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const enrollmentCount = await prisma.enrollments.count();
    if (enrollmentCount === 0) {
        console.log('No enrollments found. Please run sync_enrollments first.');
        return;
    }

    const attendanceCount = await prisma.attendance_records.count();
    const scoreCount = await prisma.student_scores.count();

    console.log('Current Attendance Records:', attendanceCount);
    console.log('Current Score Records:', scoreCount);

    if (attendanceCount === 0) {
        console.log('Generating sample attendance sessions and records...');
        const assignments = await prisma.teaching_assignments.findMany({ take: 10 });
        for (const ta of assignments) {
            const session = await prisma.attendance_sessions.create({
                data: {
                    teaching_assignment_id: ta.id,
                    session_date: new Date(),
                }
            });
            const enrolls = await prisma.enrollments.findMany({ where: { teaching_assignment_id: ta.id } });
            for (const e of enrolls) {
                await prisma.attendance_records.create({
                    data: {
                        attendance_session_id: session.id,
                        enrollment_id: e.id,
                        status: Math.random() > 0.1 ? 'present' : 'absent',
                    }
                });
            }
        }
        console.log('Sample attendance generated.');
    }

    if (scoreCount === 0) {
        console.log('Generating sample grade categories and scores...');
        const assignments = await prisma.teaching_assignments.findMany({ take: 10 });
        for (const ta of assignments) {
            const cat = await prisma.grade_categories.create({
                data: {
                    teaching_assignment_id: ta.id,
                    name: 'General',
                    weight_percent: 100
                }
            });
            const item = await prisma.assessment_items.create({
                data: {
                    grade_category_id: cat.id,
                    name: 'Midterm',
                    max_score: 50
                }
            });
            const enrolls = await prisma.enrollments.findMany({ where: { teaching_assignment_id: ta.id } });
            for (const e of enrolls) {
                await prisma.student_scores.create({
                    data: {
                        enrollment_id: e.id,
                        assessment_item_id: item.id,
                        score: Math.floor(Math.random() * 50)
                    }
                });
            }
        }
        console.log('Sample scores generated.');
    }
}

main().finally(() => prisma.$disconnect());
