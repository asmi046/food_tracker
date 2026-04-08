function createUserRepository(prisma) {
    const adminMaxUserId = process.env.ADMIN_MAX_USER_ID
        ? BigInt(process.env.ADMIN_MAX_USER_ID)
        : null;

    function isAdmin(maxUserId) {
        if (!adminMaxUserId) {
            return false;
        }
        return maxUserId === adminMaxUserId;
    }

    function canUseBot(user) {
        if (!user) {
            return false;
        }

        if (adminMaxUserId && user.maxUserId === adminMaxUserId) {
            return true;
        }

        return Boolean(user.isVerified);
    }

    async function upsertFromMaxUser(maxUser) {
        if (!maxUser?.user_id) {
            return null;
        }

        const maxUserId = BigInt(maxUser.user_id);
        const isAdminUser = isAdmin(maxUserId);
        const username = maxUser.username || null;
        const displayName = maxUser.name || 'Unknown user';
        const isBot = maxUser.is_bot || false;
        const lastActivityTime = maxUser.last_activity_time || null;

        const updateData = {
            username,
            displayName,
            isBot,
            lastActivityTime,
        };

        if (isAdminUser) {
            updateData.isVerified = true;
            updateData.verifiedAt = new Date();
        }

        return prisma.user.upsert({
            where: { maxUserId },
            update: updateData,
            create: {
                maxUserId,
                username,
                displayName,
                isBot,
                isVerified: isAdminUser,
                verifiedAt: isAdminUser ? new Date() : null,
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
        canUseBot,
    };
}

module.exports = {
    createUserRepository,
};
