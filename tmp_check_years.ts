import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const years = await prisma.academic_years.findMany();
    console.log(JSON.stringify(years, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
