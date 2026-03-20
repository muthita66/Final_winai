import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const departments = await prisma.departments.findMany();
    console.log(JSON.stringify(departments, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
