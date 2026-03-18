import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import fs from 'fs';

async function main() {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'events'
    `);
    fs.writeFileSync('prisma_debug.log', JSON.stringify(result, null, 2));
    console.log('Success');
  } catch (err) {
    fs.writeFileSync('prisma_debug.log', err.stack || err.message);
    console.log('Error');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
