const fs = require('fs/promises');

/**
 * Оркестрирует полный пайплайн обработки фото продукта:
 * 1. Сохраняем и сжимаем изображение
 * 2. Отправляем в AI для распознавания
 * 3. Записываем meal_entry и nutrition_record в БД
 */
function createProcessFoodPhotoService({
    imageStorage,
    aiAdapter,
    mealEntryRepository,
    nutritionRepository,
}) {
    async function execute({ attachment, user, chatId, messageId }) {
        console.log('[processFoodPhoto] step 1: saving and compressing image');
        const imageResult = await imageStorage.processImageAttachment({
            attachment,
            chatId,
            messageId,
        });
        console.log('[processFoodPhoto] step 1 done:', imageResult.compressedPath);

        console.log('[processFoodPhoto] step 2: sending to AI');
        const compressedBuffer = await fs.readFile(imageResult.compressedPath);
        const nutrition = await aiAdapter.analyzeImage(compressedBuffer);
        console.log('[processFoodPhoto] step 2 done:', nutrition.productName);

        console.log('[processFoodPhoto] step 3: saving meal_entry, user.id =', user.id);
        const mealEntry = await mealEntryRepository.createWithImageData(user.id, imageResult);
        console.log('[processFoodPhoto] step 3 done, mealEntry.id =', mealEntry.id);

        console.log('[processFoodPhoto] step 4: marking recognized');
        await mealEntryRepository.markRecognized(mealEntry.id);
        console.log('[processFoodPhoto] step 4 done');

        console.log('[processFoodPhoto] step 5: saving nutrition_record');
        const nutritionRecord = await nutritionRepository.createRecord(mealEntry.id, nutrition);
        console.log('[processFoodPhoto] step 5 done');

        return {
            mealEntry,
            nutritionRecord,
            nutrition,
            imageResult,
        };
    }

    return { execute };
}

module.exports = {
    createProcessFoodPhotoService,
};
