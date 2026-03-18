
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
    try {
        const categories = await prisma.subject_categories.findMany();
        const output = JSON.stringify(categories, null, 2);
        fs.writeFileSync('categories_list.txt', output);
        console.log('Done');
    } catch (e) {
        fs.writeFileSync('categories_error.txt', e.stack);
    } finally {
        await prisma.$disconnect();
    }
}

main();
