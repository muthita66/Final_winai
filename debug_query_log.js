
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

async function main() {
    const teacher_id = 1; // Try ID 1 as a guess
    const year = 2568;
    const semester = 1;

    console.log(`Searching for Teacher ID: ${teacher_id}, Year: ${year}, Semester: ${semester}`);

    try {
        const assignments = await prisma.teaching_assignments.findMany({
            where: {
                // teacher_id: teacher_id, // Let's try finding ANY teacher's assignments first
                semesters: {
                    academic_years: { year_name: String(year) },
                    semester_number: semester,
                }
            },
            include: {
                subjects: true,
                teachers: true
            }
        });
        console.log(`FOUND_ASSIGNMENTS_COUNT: ${assignments.length}`);
        if (assignments.length > 0) {
            console.log('SAMPLE_ASSIGNMENT:', JSON.stringify(assignments[0], null, 2));
        } else {
            console.log('No assignments found for Year/Semester.');
            const allYears = await prisma.academic_years.findMany();
            console.log('AVAILABLE_YEARS:', JSON.stringify(allYears, null, 2));
        }

    } catch (e) {
        console.error('ERROR_DURING_QUERY:', e);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

// Timeout after 15s
setTimeout(() => {
    console.log('TIMEOUT_REACHED');
    process.exit(1);
}, 15000);

main();
