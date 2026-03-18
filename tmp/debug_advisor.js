require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('--- DEBUG START ---');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'FOUND' : 'NOT FOUND');

    const student = await prisma.students.findFirst({
        where: { first_name: 'เมฆ', last_name: 'ทองดี' },
        include: {
            classrooms: {
                include: {
                    classroom_advisors: {
                        include: {
                            teachers: true
                        }
                    }
                }
            }
        }
    });

    if (!student) {
        console.log('Student not found');
        return;
    }

    console.log('Student:', {
        id: student.id,
        user_id: student.user_id,
        classroom_id: student.classroom_id,
        name: `${student.first_name} ${student.last_name}`
    });

    if (student.classrooms) {
        console.log('Classroom:', student.classrooms.room_name);
        console.log('Advisors count:', student.classrooms.classroom_advisors.length);
        student.classrooms.classroom_advisors.forEach((ca, idx) => {
            console.log(`Advisor ${idx + 1}:`, {
                ca_id: ca.id,
                teacher_id: ca.teacher_id,
                teacher_name: `${ca.teachers?.first_name} ${ca.teachers?.last_name}`,
                teacher_code: ca.teachers?.teacher_code
            });
        });
    } else {
        console.log('Student has no classroom');
    }

    // Check evaluation forms
    const forms = await prisma.evaluation_forms.findMany({
        where: { type: 'advisor' },
        include: { evaluation_questions: true }
    });
    console.log('Advisor evaluation forms count:', forms.length);
    forms.forEach(f => {
        console.log('Form:', { id: f.id, name: f.name, questions_count: f.evaluation_questions.length });
    });

    console.log('--- DEBUG END ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
