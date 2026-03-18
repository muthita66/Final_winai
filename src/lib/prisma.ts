import { PrismaClient } from '@prisma/client';

declare global {
    var prisma: PrismaClient | undefined;
}

if (typeof BigInt !== 'undefined') {
    (BigInt.prototype as any).toJSON = function () {
        return Number(this);
    };
}

const globalForPrisma = global as typeof globalThis & {
    prisma?: PrismaClient;
};

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: ['query'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
