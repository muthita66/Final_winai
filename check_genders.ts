import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const genders = await prisma.genders.findMany();
    console.log('Genders in DB:', JSON.stringify(genders, null, 2));
    
    const sampleStudents = await prisma.students.findMany({
        take: 10,
        include: { genders: true }
    });
    console.log('Sample Students with Gender:', JSON.stringify(sampleStudents.map(s => ({
        id: s.id,
        gender_id: s.gender_id,
        gender_name: s.genders?.name
    })), null, 2));

    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
