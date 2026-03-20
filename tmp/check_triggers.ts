import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const result = await prisma.$queryRaw`
        SELECT trg.tgname AS trigger_name,
               proc.proname AS function_name,
               CASE trg.tgtype::integer & 66
                   WHEN 2 THEN 'BEFORE'
                   WHEN 64 THEN 'INSTEAD OF'
                   ELSE 'AFTER'
               END AS trigger_type,
               CASE trg.tgtype::integer & 28
                   WHEN 4 THEN 'INSERT'
                   WHEN 8 THEN 'DELETE'
                   WHEN 16 THEN 'UPDATE'
                   WHEN 12 THEN 'INSERT OR DELETE'
                   WHEN 20 THEN 'INSERT OR UPDATE'
                   WHEN 24 THEN 'UPDATE OR DELETE'
                   WHEN 28 THEN 'INSERT OR UPDATE OR DELETE'
               END AS trigger_event
        FROM pg_trigger trg
        JOIN pg_class cls ON trg.tgrelid = cls.oid
        JOIN pg_proc proc ON trg.tgfoid = proc.oid
        WHERE cls.relname = 'events';
    `;
    console.log(JSON.stringify(result, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
