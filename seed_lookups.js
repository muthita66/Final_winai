const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking connectivity...');
  try {
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    console.log('Connected:', result);
    
    const ptCount = await prisma.project_types.count();
    console.log('Project Types Count:', ptCount);
    
    if (ptCount === 0) {
      console.log('Seeding Project Types...');
      await prisma.project_types.createMany({
        data: [
          { name: 'โครงการตามแผนปฏิบัติการ' },
          { name: 'โครงการเร่งด่วน' },
          { name: 'โครงการพิเศษ' },
          { name: 'กิจกรรมพัฒนาผู้เรียน' }
        ]
      });
      console.log('Project Types Seeded.');
    }

    const btCount = await prisma.budget_types.count();
    console.log('Budget Types Count:', btCount);
    if (btCount === 0) {
      console.log('Seeding Budget Types...');
      await prisma.budget_types.createMany({
        data: [
          { name: 'เงินงบประมาณ (งบอุดหนุน)' },
          { name: 'เงินนอกงบประมาณ' },
          { name: 'เงินรายได้สถานศึกษา' },
          { name: 'เงินบริจาค' }
        ]
      });
      console.log('Budget Types Seeded.');
    }

    const sgCount = await prisma.learning_subject_groups.count();
    console.log('Subject Groups Count:', sgCount);
    if (sgCount === 0) {
      console.log('Seeding Subject Groups...');
      await prisma.learning_subject_groups.createMany({
        data: [
          { group_name: 'ภาษาไทย' },
          { group_name: 'คณิตศาสตร์' },
          { group_name: 'วิทยาศาสตร์และเทคโนโลยี' },
          { group_name: 'สังคมศึกษา ศาสนา และวัฒนธรรม' },
          { group_name: 'สุขศึกษาและพลศึกษา' },
          { group_name: 'ศิลปะ' },
          { group_name: 'การงานอาชีพ' },
          { group_name: 'ภาษาต่างประเทศ' }
        ]
      });
      console.log('Subject Groups Seeded.');
    }

  } catch (e) {
    console.error('Error:', e);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
