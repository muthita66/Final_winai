import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const columns = await prisma.$queryRaw`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'activity_evaluation_link' 
            ORDER BY ordinal_position
        `;
        console.log("=== activity_evaluation_link Columns ===");
        console.table(columns);
    } catch (e) {
        console.error("Table might not exist:", e);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
