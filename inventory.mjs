import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import fs from 'fs';

async function main() {
  try {
    const eventsCols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'events'
    `);
    const tables = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    fs.writeFileSync('db_inventory.log', JSON.stringify({ eventsCols, tables }, null, 2));
    console.log('Done');
  } catch (err) {
    fs.writeFileSync('db_inventory.log', err.stack || err.message);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
