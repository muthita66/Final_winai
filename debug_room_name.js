const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    try {
        const room = await prisma.classrooms.findFirst({
            select: { room_name: true }
        });
        console.log('Sample Room Name:', room?.room_name);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}
main();
