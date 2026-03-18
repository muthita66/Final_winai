import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const teacherCount = await prisma.teachers.count();
        console.log(`Total teachers: ${teacherCount}`);

        const teachers = await prisma.teachers.findMany({
            take: 5,
            select: {
                id: true,
                first_name: true,
                last_name: true
            }
        });

        console.log('Sample teachers:');
        console.log(JSON.stringify(teachers, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
