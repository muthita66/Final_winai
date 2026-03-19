import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const p = new PrismaClient();

async function main() {
    const forms = await p.$queryRaw`SELECT id, form_name, is_active FROM evaluation_forms ORDER BY id`;
    fs.writeFileSync('db_out.json', JSON.stringify(forms, (_, v) => typeof v === 'bigint' ? Number(v) : v, 2));
    
    // Also get sections for the first active form if any
    const activeForms = forms.filter((f: any) => f.is_active);
    if (activeForms.length > 0) {
        const sections = await p.$queryRaw`SELECT id, form_id, section_name FROM evaluation_sections WHERE form_id = ${activeForms[0].id}`;
        fs.writeFileSync('db_sections.json', JSON.stringify(sections, (_, v) => typeof v === 'bigint' ? Number(v) : v, 2));
    }
}

main().catch(e => fs.writeFileSync('db_error.txt', e.toString())).finally(() => p.$disconnect());
