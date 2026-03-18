const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const director = await prisma.users.findFirst({
        where: {
            roles: {
                role_name: 'director'
            }
        },
        select: {
            username: true
        }
    });
    console.log(JSON.stringify(director));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
