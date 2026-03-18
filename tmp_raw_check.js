const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function check() {
    console.log('--- RAW FORMS CHECK ---');
    try {
        const forms = await prisma.$queryRaw`SELECT * FROM evaluation_forms LIMIT 5`;
        console.log('Forms (Raw):', JSON.stringify(forms, null, 2));

        const types = await prisma.$queryRaw`SELECT * FROM evaluation_form_types`;
        console.log('Form Types:', JSON.stringify(types, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();
