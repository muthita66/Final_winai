const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function check() {
    console.log('--- DB CHECK ---');
    try {
        const student = await prisma.students.findFirst({
            where: { first_name: 'เมฆ' },
            select: { id: true, classroom_id: true }
        });
        console.log('Student:', student);

        const forms = await prisma.evaluation_forms.findMany({
            where: { type: 'advisor' }
        });
        console.log('Advisor Forms:', forms.length);

        const periods = await prisma.evaluation_periods.findMany({
            take: 5,
            orderBy: { id: 'desc' }
        });
        console.log('Recent Periods:', periods.map(p => ({ id: p.id, name: p.name })));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();
