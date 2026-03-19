const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking grade_categories table...');
  
  // Check current columns
  const cols = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'grade_categories'
    ORDER BY ordinal_position
  `;
  console.log('Current columns:', JSON.stringify(cols, null, 2));
  
  // Check if "name" column already exists
  const hasName = cols.some(c => c.column_name === 'name');
  const hasWeightPercent = cols.some(c => c.column_name === 'weight_percent');
  
  if (!hasName) {
    console.log('Adding missing "name" column...');
    await prisma.$executeRawUnsafe(`ALTER TABLE grade_categories ADD COLUMN IF NOT EXISTS name VARCHAR(100) NOT NULL DEFAULT 'Category'`);
    console.log('Done: Added "name" column');
  } else {
    console.log('Column "name" already exists');
  }

  if (!hasWeightPercent) {
    console.log('Adding missing "weight_percent" column...');
    await prisma.$executeRawUnsafe(`ALTER TABLE grade_categories ADD COLUMN IF NOT EXISTS weight_percent DECIMAL(5,2) NOT NULL DEFAULT 100`);
    console.log('Done: Added "weight_percent" column');
  } else {
    console.log('Column "weight_percent" already exists');
  }
  
  // Verify
  const colsAfter = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'grade_categories'
    ORDER BY ordinal_position
  `;
  console.log('Columns after fix:', colsAfter.map(c => c.column_name));
}

main().catch(console.error).finally(() => prisma.$disconnect());
