import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const events = await prisma.events.findMany({ take: 5 });
    console.log("Events:", events);

    const forms = await prisma.evaluation_forms.findMany();
    console.log("Evaluation Forms:", forms.map(f => ({ id: f.id, name: f.form_name, type: f.evaluation_type_id })));

    const sections = await prisma.evaluation_sections.findMany();
    console.log("Evaluation Sections:", sections.map(s => ({ id: s.id, name: s.section_name, form: s.form_id })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
