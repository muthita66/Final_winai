
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const assignments = await prisma.teaching_assignments.findMany({
            take: 20,
            include: {
                semesters: { include: { academic_years: true } }
            }
        });
        console.log('--- ALL ASSIGNMENTS ---');
        assignments.forEach(a => {
            console.log(`ID: ${a.id}, Teacher: ${a.teacher_id}, Year: ${a.semesters?.academic_years?.year_name}, Sem: ${a.semesters?.semester_number}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
