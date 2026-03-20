const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    console.log('Verifying Learning Subject Group visibility...');

    try {
        // 1. Verify Target Types
        const learningGroup = await prisma.target_types.findUnique({
            where: { code: 'learning_group' }
        });
        if (learningGroup && learningGroup.is_active) {
            console.log('✅ Found active learning_group in target_types table');
        } else {
            console.log('❌ learning_group NOT found or inactive in target_types table');
        }

        // 2. Verify Constraint
        const constraints = await prisma.$queryRaw`
            SELECT pg_get_constraintdef(oid) 
            FROM pg_constraint 
            WHERE conname = 'events_visibility_check';
        `;
        const def = constraints[0]?.pg_get_constraintdef || '';
        if (def.includes('learning_group')) {
            console.log('✅ events_visibility_check constraint includes learning_group');
        } else {
            console.log('❌ events_visibility_check constraint does NOT include learning_group');
        }

        // 3. Verify Learning Groups count
        const count = await prisma.learning_subject_groups.count();
        console.log(`✅ Database contains ${count} learning subject groups.`);

    } catch (error) {
        console.error('Verification failed:', error);
    }
}

verify().finally(() => prisma.$disconnect());
