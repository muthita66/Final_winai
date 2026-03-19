const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("--- Checking Evaluation Database ---");
  
  try {
    const categories = await prisma.evaluation_categories.findMany();
    console.log("\nCategories:", JSON.stringify(categories, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

    const forms = await prisma.evaluation_forms.findMany();
    console.log("\nForms:", JSON.stringify(forms, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

    const sections = await prisma.evaluation_sections.findMany();
    console.log("\nSections:", JSON.stringify(sections, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

    const questionsCount = await prisma.evaluation_questions.count();
    console.log("\nTotal Questions Count:", questionsCount);

    if (forms.length > 0) {
        for (const form of forms) {
            const formSections = await prisma.evaluation_sections.findMany({
                where: { form_id: form.id }
            });
            console.log(`\nSections for Form '${form.form_name}' (ID: ${form.id}):`, JSON.stringify(formSections, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
        }
    }

  } catch (error) {
    console.error("Error querying database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
