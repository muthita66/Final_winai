
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    const categories = await prisma.subject_categories.findMany();
    fs.writeFileSync('categories_output.txt', JSON.stringify(categories, null, 2));
}

main()
    .catch(e => {
        fs.writeFileSync('categories_error.txt', e.toString());
    })
    .finally(async () => await prisma.$disconnect());
