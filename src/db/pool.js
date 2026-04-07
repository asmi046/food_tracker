const { PrismaClient } = require('@prisma/client');

function getPrismaClient() {
    const prisma = new PrismaClient();
    return prisma;
}

module.exports = {
    getPrismaClient,
};
