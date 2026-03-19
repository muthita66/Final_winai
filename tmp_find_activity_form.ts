import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const forms = await prisma.evaluation_forms.findMany({
            where: {
                OR: [
                    { form_name: { contains: 'กิจกรรม', mode: 'insensitive' } },
                    { form_name: { contains: 'Activity', mode: 'insensitive' } }
                ]
            }
        });
        console.log("=== Found Activity Forms ===");
        console.table(forms.map(f => ({ id: f.id, name: f.form_name })));
    } catch (e) {
        console.error(e);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
