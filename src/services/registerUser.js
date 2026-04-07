function extractMaxUserFromContext(ctx) {
    if (ctx?.user?.user_id) {
        return ctx.user;
    }

    if (ctx?.message?.sender?.user_id) {
        return ctx.message.sender;
    }

    return null;
}

async function registerUserFromContext(ctx, userRepository) {
    const maxUser = extractMaxUserFromContext(ctx);
    if (!maxUser) {
        return null;
    }

    return userRepository.upsertFromMaxUser(maxUser);
}

async function getUserFromContext(ctx, userRepository) {
    const maxUser = extractMaxUserFromContext(ctx);
    if (!maxUser?.user_id) {
        return null;
    }

    return userRepository.findByMaxUserId(maxUser.user_id);
}

module.exports = {
    registerUserFromContext,
    getUserFromContext,
};
