import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
    try {
        console.log("Testing Prisma connection...");
        const teacher = await prisma.teachers.findFirst();
        console.log("Teacher found:", teacher?.id);

        if (teacher) {
            console.log("Fetching sample data from evaluation_responses...");
            try {
                const data = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT * FROM evaluation_responses ORDER BY id DESC LIMIT 5`
                );
                console.log("Sample Data:", JSON.stringify(data, null, 2));
            } catch (err: any) {
                console.error("DATA QUERY FAILED:", err.message);
            }
        }
    } catch (err: any) {
        console.error("PRISMA ERROR:", err.message);
        console.error("STACK:", err.stack);
    } finally {
        await prisma.$disconnect();
    }
}

test();
