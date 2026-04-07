function createUserRepository(prisma) {
    async function upsertFromMaxUser(maxUser) {
        if (!maxUser?.user_id) {
            return null;
        }

        const maxUserId = BigInt(maxUser.user_id);
        const username = maxUser.username || null;
        const displayName = maxUser.name || 'Unknown user';
        const isBot = maxUser.is_bot || false;
        const lastActivityTime = maxUser.last_activity_time || null;

        return prisma.user.upsert({
            where: { maxUserId },
            update: {
                username,
                displayName,
                isBot,
                lastActivityTime,
            },
            create: {
                maxUserId,
                username,
                displayName,
                isBot,
                lastActivityTime,
            },
        });
    }

    async function findByMaxUserId(maxUserId) {
        return prisma.user.findUnique({
            where: { maxUserId: BigInt(maxUserId) },
        });
    }

    return {
        upsertFromMaxUser,
        findByMaxUserId,
    };
}

module.exports = {
    createUserRepository,
};
