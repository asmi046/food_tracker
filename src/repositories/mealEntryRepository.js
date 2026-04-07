function createMealEntryRepository(prisma) {
    async function createWithImageData(userId, imageData) {
        return prisma.mealEntry.create({
            data: {
                userId,
                imageId: imageData.id,
                imageOriginalPath: imageData.originalPath,
                imageCompressedPath: imageData.compressedPath,
                imageSizeOriginal: imageData.originalBytes,
                imageSizeCompressed: imageData.compressedBytes,
            },
        });
    }

    async function findWithNutritionByDate(userId, date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return prisma.mealEntry.findMany({
            where: {
                userId,
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            include: {
                nutrition: true,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
    }

    async function markRecognized(mealEntryId) {
        return prisma.mealEntry.update({
            where: { id: mealEntryId },
            data: { recognizedAt: new Date() },
        });
    }

    async function findLatestByUser(userId, limit = 10) {
        return prisma.mealEntry.findMany({
            where: { userId },
            include: { nutrition: true },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    return {
        createWithImageData,
        markRecognized,
        findWithNutritionByDate,
        findLatestByUser,
    };
}

module.exports = {
    createMealEntryRepository,
};
