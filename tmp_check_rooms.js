const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const rooms = await prisma.classrooms.findMany({take: 10});
    console.log(rooms);
    process.exit(0);
}
main();
