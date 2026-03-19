const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const criteria = [
    // มัธยมศึกษาปีที่ 1
    { test_name: 'วิ่ง 50 เมตร', grade_level: 'มัธยมศึกษาปีที่ 1', passing_threshold: 9.5, unit: 'วินาที', comparison_type: '<=' },
    { test_name: 'ยืนกระโดดไกล', grade_level: 'มัธยมศึกษาปีที่ 1', passing_threshold: 160, unit: 'เซนติเมตร', comparison_type: '>=' },
    { test_name: 'ลุก-นั่ง 60 วินาที', grade_level: 'มัธยมศึกษาปีที่ 1', passing_threshold: 25, unit: 'ครั้ง', comparison_type: '>=' },
    
    // มัธยมศึกษาปีที่ 2
    { test_name: 'วิ่ง 50 เมตร', grade_level: 'มัธยมศึกษาปีที่ 2', passing_threshold: 9.2, unit: 'วินาที', comparison_type: '<=' },
    { test_name: 'ยืนกระโดดไกล', grade_level: 'มัธยมศึกษาปีที่ 2', passing_threshold: 170, unit: 'เซนติเมตร', comparison_type: '>=' },
    
    // มัธยมศึกษาปีที่ 3 
    { test_name: 'วิ่ง 50 เมตร', grade_level: 'มัธยมศึกษาปีที่ 3', passing_threshold: 9.0, unit: 'วินาที', comparison_type: '<=' },
    { test_name: 'ยืนกระโดดไกล', grade_level: 'มัธยมศึกษาปีที่ 3', passing_threshold: 180, unit: 'เซนติเมตร', comparison_type: '>=' },
  ];

  console.log('Seeding fitness criteria...');
  
  for (const item of criteria) {
    await prisma.fitness_test_criteria.create({
      data: {
        ...item,
        academic_year: 2568, // Default year
      }
    });
  }

  console.log('Done!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
