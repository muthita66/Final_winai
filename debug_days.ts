
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const days = await prisma.day_of_weeks.findMany();
    console.log(JSON.stringify(days, null, 2));

    // Also check teaching assignments for a specific teacher to see day distribution
    const schedules = await prisma.class_schedules.findMany({
        include: {
            day_of_weeks: true,
            teaching_assignments: {
                include: {
                    subjects: true
                }
            }
        },
        take: 20
    });
    console.log('--- Sample Schedules ---');
    console.log(JSON.stringify(schedules, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
