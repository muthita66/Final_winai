
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
    try {
        const forms = await prisma.evaluation_forms.findMany({
            select: { id: true, form_name: true, is_active: true }
        });
        const categories = await prisma.evaluation_categories.findMany();
        
        const output = {
            forms,
            categories
        };
        
        fs.writeFileSync('db_output.json', JSON.stringify(output, null, 2));
        console.log('Done');
    } catch (e) {
        fs.writeFileSync('db_error.txt', e.stack);
        console.log('Error');
    } finally {
        await prisma.$disconnect();
    }
}

main();
