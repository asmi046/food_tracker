require('dotenv').config();
const { Bot, Keyboard } = require('@maxhub/max-bot-api');
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

const REPORT_DAY_PAYLOAD = 'report_day';
const REPORT_WEEK_PAYLOAD = 'report_week';

function getReportKeyboard() {
    return [
        Keyboard.inlineKeyboard([
            [
                Keyboard.button.callback('Отчет за день', REPORT_DAY_PAYLOAD),
                Keyboard.button.callback('Отчет за неделю', REPORT_WEEK_PAYLOAD),
            ],
        ]),
    ];
}

function toNumber(value) {
    return Number(value || 0);
}

function formatReport(entries, title) {
    const withNutrition = entries.filter((entry) => entry.nutrition);

    if (withNutrition.length === 0) {
        return `${title}\n\nНет данных по приемам пищи за этот период.`;
    }

    const totals = withNutrition.reduce(
        (acc, entry) => {
            acc.proteins += toNumber(entry.nutrition.proteins);
            acc.fats += toNumber(entry.nutrition.fats);
            acc.carbs += toNumber(entry.nutrition.carbs);
            acc.calories += toNumber(entry.nutrition.calories);
            return acc;
        },
        { proteins: 0, fats: 0, carbs: 0, calories: 0 }
    );

    return (
        `${title}\n\n` +
        `Приемов пищи: ${withNutrition.length}\n` +
        `Белки: ${totals.proteins.toFixed(1)} г\n` +
        `Жиры: ${totals.fats.toFixed(1)} г\n` +
        `Углеводы: ${totals.carbs.toFixed(1)} г\n` +
        `Калории: ${totals.calories.toFixed(1)} ккал`
    );
}

async function getAuthorizedUserFromContext(ctx) {
    const user = await getUserFromContext(ctx, userRepository);
    if (!user) {
        await ctx.reply('Не удалось определить пользователя. Попробуй написать /start.');
        return null;
    }

    if (!userRepository.canUseBot(user)) {
        await ctx.reply(
            'Доступ к боту пока ограничен.\n' +
            'Твой аккаунт создан и ожидает верификации администратором.'
        );
        return null;
    }

    return user;
}

async function sendDailyReport(ctx, user) {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const entries = await mealEntryRepository.findWithNutritionByRange(user.id, start, end);
    await ctx.reply(formatReport(entries, 'Отчет за день'));
}

async function sendWeeklyReport(ctx, user) {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const entries = await mealEntryRepository.findWithNutritionByRange(user.id, start, end);
    await ctx.reply(formatReport(entries, 'Отчет за 7 дней'));
}

bot.on('bot_started', async (ctx) => {
    try {
        await registerUserFromContext(ctx, userRepository);
    } catch (error) {
        console.error('User registration error on bot_started:', error);
    }

    ctx.reply(
        'Я определяю калорийность и БЖУ продуктов по фото. Если твой аккаунт активирован, просто пришли фото еды, и я скажу, что на ней и сколько это стоит калорий и БЖУ. Если аккаунт не активирован, он будет создан и ожидает верификации администратором.',
        { attachments: getReportKeyboard() }
    );
});

bot.on('message_created', async (ctx) => {
    try {
        await registerUserFromContext(ctx, userRepository);
    } catch (error) {
        console.error('User registration error on message_created:', error);
    }

    const user = await getAuthorizedUserFromContext(ctx);
    if (!user) return;

    const text = ctx?.message?.body?.text;
    const imageAttachment = imageStorage.getImageAttachment(ctx?.message);

    if (text === '/report_day' || text === 'Отчет за день') {
        await sendDailyReport(ctx, user);
        return;
    }

    if (text === '/report_week' || text === 'Отчет за неделю') {
        await sendWeeklyReport(ctx, user);
        return;
    }

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

    await ctx.reply('Пришлите фото продукта, и я определю его калорийность и БЖУ.', {
        attachments: getReportKeyboard(),
    });
});

bot.action(REPORT_DAY_PAYLOAD, async (ctx) => {
    try {
        const user = await getAuthorizedUserFromContext(ctx);
        if (!user) {
            await ctx.answerOnCallback({ notification: 'Нет доступа' });
            return;
        }

        await sendDailyReport(ctx, user);
        await ctx.answerOnCallback({ notification: 'Отчет за день готов' });
    } catch (error) {
        console.error('Daily report callback error:', error);
        await ctx.answerOnCallback({ notification: 'Не удалось собрать отчет' });
    }
});

bot.action(REPORT_WEEK_PAYLOAD, async (ctx) => {
    try {
        const user = await getAuthorizedUserFromContext(ctx);
        if (!user) {
            await ctx.answerOnCallback({ notification: 'Нет доступа' });
            return;
        }

        await sendWeeklyReport(ctx, user);
        await ctx.answerOnCallback({ notification: 'Отчет за неделю готов' });
    } catch (error) {
        console.error('Weekly report callback error:', error);
        await ctx.answerOnCallback({ notification: 'Не удалось собрать отчет' });
    }
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