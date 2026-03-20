const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Running database migration for Learning Subject Group visibility...');

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Update events_visibility_check constraint
            console.log('Updating events_visibility_check constraint...');
            await tx.$executeRaw`
                ALTER TABLE events 
                DROP CONSTRAINT IF EXISTS events_visibility_check;
            `;
            await tx.$executeRaw`
                ALTER TABLE events 
                ADD CONSTRAINT events_visibility_check 
                CHECK (visibility::text = ANY (ARRAY[
                    'public'::text, 
                    'restricted'::text, 
                    'all'::text, 
                    'grade_level'::text, 
                    'classroom'::text, 
                    'teaching_assignment'::text,
                    'learning_group'::text
                ]));
            `;

            // 2. Insert into target_types
            console.log('Inserting into target_types...');
            const exists = await tx.target_types.findUnique({
                where: { code: 'learning_group' }
            });

            if (!exists) {
                await tx.target_types.create({
                    data: {
                        code: 'learning_group',
                        display_name: 'กลุ่มสาระการเรียนรู้',
                        description: 'เลือกตามกลุ่มสาระการเรียนรู้',
                        is_active: true,
                        input_type: 'select',
                        data_source_api: '/api/options/learning-groups'
                    }
                });
                console.log('Inserted learning_group target type.');
            } else {
                await tx.target_types.update({
                    where: { code: 'learning_group' },
                    data: {
                        display_name: 'กลุ่มสาระการเรียนรู้',
                        description: 'เลือกตามกลุ่มสาระการเรียนรู้',
                        is_active: true,
                        input_type: 'select',
                        data_source_api: '/api/options/learning-groups'
                    }
                });
                console.log('Updated existing learning_group target type.');
            }
        });
        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
