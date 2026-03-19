import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const student = await prisma.students.findFirst({
            where: { first_name: { contains: 'เมฆ' } },
            select: { id: true, user_id: true }
        });
        const sem = await prisma.semesters.findFirst({
            where: {
                semester_number: 1,
                academic_years: { year_name: '2569' }
            },
            include: { academic_years: true }
        });

        const result = {
            student,
            semester: sem ? {
                id: sem.id,
                start: sem.start_date,
                end: sem.end_date,
                year_start: sem.academic_years.start_date,
                year_end: sem.academic_years.end_date
            } : null
        };

        process.stdout.write(JSON.stringify(result, null, 2));
    } catch (e: any) {
        process.stdout.write("Error: " + e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
