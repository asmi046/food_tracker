function createNutritionRepository(prisma) {
    async function createRecord(mealEntryId, nutritionData) {
        return prisma.nutritionRecord.create({
            data: {
                mealEntryId,
                productName: nutritionData.productName,
                proteins: nutritionData.proteins,
                fats: nutritionData.fats,
                carbs: nutritionData.carbs,
                calories: nutritionData.calories,
                aiProvider: nutritionData.aiProvider || null,
                aiModel: nutritionData.aiModel || null,
                aiRawResponse: nutritionData.aiRawResponse || null,
            },
        });
    }

    async function findByMealEntryId(mealEntryId) {
        return prisma.nutritionRecord.findUnique({
            where: { mealEntryId },
        });
    }

    return {
        createRecord,
        findByMealEntryId,
    };
}

module.exports = {
    createNutritionRepository,
};
