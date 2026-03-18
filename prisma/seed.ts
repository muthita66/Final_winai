import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding lookup data...');

    const projectTypes = [
        { name: 'โครงการตามแผนปฏิบัติการ' },
        { name: 'โครงการเร่งด่วน' },
        { name: 'โครงการพิเศษ' },
        { name: 'กิจกรรมพัฒนาผู้เรียน' }
    ];

    for (const pt of projectTypes) {
        const existing = await prisma.project_types.findFirst({
            where: { name: pt.name }
        });
        if (!existing) {
            await prisma.project_types.create({
                data: pt,
            });
        }
    }

    const budgetTypes = [
        { name: 'เงินงบประมาณ (งบอุดหนุน)' },
        { name: 'เงินนอกงบประมาณ' },
        { name: 'เงินรายได้สถานศึกษา' },
        { name: 'เงินบริจาค' }
    ];

    for (const bt of budgetTypes) {
        const existing = await prisma.budget_types.findFirst({
            where: { name: bt.name }
        });
        if (!existing) {
            await prisma.budget_types.create({
                data: bt,
            });
        }
    }

    const subjectGroups = [
        { group_name: 'ภาษาไทย' },
        { group_name: 'คณิตศาสตร์' },
        { group_name: 'วิทยาศาสตร์และเทคโนโลยี' },
        { group_name: 'สังคมศึกษา ศาสนา และวัฒนธรรม' },
        { group_name: 'สุขศึกษาและพลศึกษา' },
        { group_name: 'ศิลปะ' },
        { group_name: 'การงานอาชีพ' },
        { group_name: 'ภาษาต่างประเทศ' }
    ];

    for (const sg of subjectGroups) {
        await prisma.learning_subject_groups.upsert({
            where: { group_name: sg.group_name },
            update: {},
            create: sg,
        });
    }

    console.log('Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
