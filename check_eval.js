const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const subject = await prisma.subjects.findFirst({
        where: { subject_name: { contains: 'กิจกรรมเพื่อสังคมและสาธารณะ 3' } },
        select: { id: true, subject_code: true, subject_name: true, evaluation_type_id: true }
    });
    console.log("Subject:", subject);
    
    const evalTypes = await prisma.evaluation_types.findMany();
    console.log("Eval Types:", evalTypes);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
