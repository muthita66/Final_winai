import { prisma } from '@/lib/prisma';

export default async function TestDbPage() {
    try {
        const forms = await prisma.$queryRaw`SELECT id, form_name, is_active FROM evaluation_forms ORDER BY id`;
        
        let sections: any[] = [];
        if (forms && Array.isArray(forms)) {
            const activeForms = forms.filter((f: any) => f.is_active);
            if (activeForms.length > 0) {
                sections = await prisma.$queryRaw`SELECT id, form_id, section_name FROM evaluation_sections WHERE form_id = ${activeForms[0].id}`;
            }
        }

        const data = {
            forms: JSON.parse(JSON.stringify(forms, (_, v) => typeof v === 'bigint' ? Number(v) : v)),
            sections: JSON.parse(JSON.stringify(sections, (_, v) => typeof v === 'bigint' ? Number(v) : v)),
        };

        return (
            <div>
                <h1>Test API DB Output</h1>
                <pre id="db-output" style={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(data, null, 2)}
                </pre>
            </div>
        );
    } catch (error: any) {
        return <div>Error: {error.message}</div>;
    }
}
