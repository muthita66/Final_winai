const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Fixing null names in grade_categories...");
        const res1 = await prisma.$executeRawUnsafe(`UPDATE grade_categories SET name = 'Unnamed Category' WHERE name IS NULL`);
        console.log(\`Updated \${res1} rows in grade_categories\`);

        console.log("Fixing null names in assessment_items...");
        const res2 = await prisma.$executeRawUnsafe(`UPDATE assessment_items SET name = 'Unnamed Item' WHERE name IS NULL`);
        console.log(\`Updated \${res2} rows in assessment_items\`);

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}
main().then(() => { process.exit(0) }).catch(() => process.exit(1));
