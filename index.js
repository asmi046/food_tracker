require('dotenv').config();
const { Bot } = require('@maxhub/max-bot-api');
const path = require('path');
const { createImageStorage } = require('./src/services/imageStorage');
const { getPrismaClient } = require('./src/db/pool');
const { createUserRepository } = require('./src/repositories/userRepository');
const { createMealEntryRepository } = require('./src/repositories/mealEntryRepository');
const { createNutritionRepository } = require('./src/repositories/nutritionRepository');
const { registerUserFromContext, getUserFromContext } = require('./src/services/registerUser');
const { createAiAdapter } = require('./src/infrastructure/ai/index');
const { createProcessFoodPhotoService } = require('./src/services/processFoodPhoto');

const token = process.env.MAX_BOT_TOKEN;
if (!token) {
    throw new Error('MAX_BOT_TOKEN is required in .env');
}

const bot = new Bot(token);
const imageStorage = createImageStorage(path.join(__dirname, 'uploads'));
const prisma = getPrismaClient();
const userRepository = createUserRepository(prisma);
const mealEntryRepository = createMealEntryRepository(prisma);
const nutritionRepository = createNutritionRepository(prisma);
const aiAdapter = createAiAdapter();
const processFoodPhoto = createProcessFoodPhotoService({
    imageStorage,
    aiAdapter,
    mealEntryRepository,
    nutritionRepository,
});

bot.on('bot_started', async (ctx) => {
    try {
        await registerUserFromContext(ctx, userRepository);
    } catch (error) {
        console.error('User registration error on bot_started:', error);
    }

    ctx.reply('Я определяю калорийность и БЖУ продуктов по фото. Если твой аккаунт активирован, просто пришли фото еды, и я скажу, что на ней и сколько это стоит калорий и БЖУ. Если аккаунт не активирован, он будет создан и ожидает верификации администратором.');
});

bot.on('message_created', async (ctx) => {
    try {
        await registerUserFromContext(ctx, userRepository);
    } catch (error) {
        console.error('User registration error on message_created:', error);
    }

    const user = await getUserFromContext(ctx, userRepository);
    if (!user) {
        await ctx.reply('Не удалось определить пользователя. Попробуй написать /start.');
        return;
    }

    if (!userRepository.canUseBot(user)) {
        await ctx.reply(
            'Доступ к боту пока ограничен.\n' +
            'Твой аккаунт создан и ожидает верификации администратором.'
        );
        return;
    }

    const text = ctx?.message?.body?.text;
    const imageAttachment = imageStorage.getImageAttachment(ctx?.message);

    if (imageAttachment) {
        await ctx.reply('Фото получено, анализирую...');
        try {
            const { nutrition } = await processFoodPhoto.execute({
                attachment: imageAttachment,
                user,
                chatId: ctx.chatId,
                messageId: ctx.messageId,
            });

            await ctx.reply(
                `🍽 ${nutrition.productName}\n\n` +
                `Оценка порции: ${nutrition.portionGrams} г\n\n` +
                `Белки:    ${nutrition.proteins} г\n` +
                `Жиры:     ${nutrition.fats} г\n` +
                `Углеводы: ${nutrition.carbs} г\n` +
                `Калории:  ${nutrition.calories} ккал\n\n` +
                `(для всей порции на фото)`
            );
            return;
        } catch (error) {
            console.error('Food photo processing error:', error.message);
            console.error('Stack:', error.stack);
            await ctx.reply('Не удалось проанализировать фото. Попробуй отправить другое изображение.');
            return;
        }
    }

    await ctx.reply('Пришлите фото продукта, и я определю его калорийность и БЖУ.');
});

bot.catch((err) => {
    console.error('Bot error:', err);
    process.exit(1);
});

imageStorage.ensureStorage()
    .then(async () => {
        bot.start();
        console.log('Bot started with Prisma');
    })
    .catch((err) => {
        console.error('Startup init error:', err);
        process.exit(1);
    })
    .finally(() => {
        process.on('SIGTERM', async () => {
            await prisma.$disconnect();
            process.exit(0);
        });
    });