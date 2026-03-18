const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing connection...');
        await prisma.$connect();
        console.log('Connected.');
        
        console.log('Checking projects table...');
        const projects = await prisma.projects.findMany({ take: 1 });
        console.log('Projects table exists. First row col names:', Object.keys(projects[0] || {}));
        
        console.log('Checking project_expenses table...');
        try {
            const expenses = await prisma.project_expenses.findMany({ take: 1 });
            console.log('Project expenses table exists.');
        } catch (e) {
            console.log('Project expenses table does NOT exist or error:', e.message);
        }
    } catch (e) {
        console.error('Connection failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
