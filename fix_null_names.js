const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const students = await prisma.students.findMany({
        where: {
            OR: [
                { first_name: 'NULL' },
                { last_name: 'NULL' },
                { first_name: '' },
                { last_name: '' }
            ]
        }
    });

    console.log(`Found ${students.length} students with NULL or empty names.`);

    for (const s of students) {
        const newFirst = (s.first_name === 'NULL' || !s.first_name) ? 'นักเรียน' : s.first_name;
        const newLast = (s.last_name === 'NULL' || !s.last_name) ? (s.student_code || s.id) : s.last_name;

        await prisma.students.update({
            where: { id: s.id },
            data: { first_name: String(newFirst), last_name: String(newLast) }
        });
    }

    console.log('Name cleanup finished.');
}

main().finally(() => prisma.$disconnect());
