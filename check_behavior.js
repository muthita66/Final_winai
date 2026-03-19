const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.behavior_records.findMany({
  take: 10,
  select: {
    id: true,
    student_id: true,
    reporter_user_id: true,
    approved_by_user_id: true,
    status: true
  }
}).then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(e => console.error(e))
  .finally(() => p.$disconnect());
