const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const projects = await prisma.projects.findMany({
        include: {
            teachers: true,
            departments: true,
            project_types: true,
            budget_types: true
        }
    });
    console.log(JSON.stringify(projects, null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
