const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const forms = await p.$queryRaw`SELECT id, form_name, is_active FROM evaluation_forms ORDER BY id`;
    console.log('=== evaluation_forms ===');
    console.log(JSON.stringify(forms, (_, v) => typeof v === 'bigint' ? Number(v) : v, 2));

    const sections = await p.$queryRaw`SELECT id, form_id, section_name FROM evaluation_sections ORDER BY form_id, id LIMIT 20`;
    console.log('=== evaluation_sections (first 20) ===');
    console.log(JSON.stringify(sections, (_, v) => typeof v === 'bigint' ? Number(v) : v, 2));
}

main().catch(console.error).finally(() => p.$disconnect());
