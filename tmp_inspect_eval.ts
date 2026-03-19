import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const categories = await prisma.evaluation_categories.findMany();
        console.log("=== Evaluation Categories ===");
        console.table(categories.map(c => ({ id: c.id, name: c.category_name })));

        const forms = await prisma.evaluation_forms.findMany({
            include: { evaluation_categories: true }
        });
        console.log("\n=== Evaluation Forms ===");
        console.table(forms.map(f => ({ 
            id: f.id, 
            name: f.form_name, 
            category: f.evaluation_categories?.category_name,
            is_active: f.is_active 
        })));

        const levelExist = await prisma.levels.findMany({ take: 1 });
        console.log("\nLevels check:", levelExist.length > 0 ? "Exists" : "Empty");

        const semesterExist = await prisma.semesters.findMany({ take: 1 });
        console.log("Semesters check:", semesterExist.length > 0 ? "Exists" : "Empty");

    } catch (e) {
        console.error(e);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
