/**
 * Тестовый стенд для проверки AI-адаптера.
 *
 * Запуск с локальным файлом:
 *   node scripts/testAI.js путь/к/фото.jpg
 *
 * Запуск с URL изображения:
 *   node scripts/testAI.js https://example.com/food.jpg
 *
 * Без аргументов: ищет первый файл в uploads/compressed/
 */
require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const { createAiAdapter } = require('../src/infrastructure/ai/index');

async function getImageBuffer(input) {
    if (!input) {
        // Берем первый файл из uploads/compressed/
        const compressedDir = path.join(__dirname, '..', 'uploads', 'compressed');
        let files;
        try {
            files = await fs.readdir(compressedDir);
        } catch {
            throw new Error(
                'Папка uploads/compressed не найдена. ' +
                'Укажи путь к изображению как аргумент: node scripts/testAI.js /path/to/image.jpg'
            );
        }

        const jpgs = files.filter((f) => f.endsWith('.jpg'));
        if (jpgs.length === 0) {
            throw new Error(
                'В uploads/compressed нет файлов. ' +
                'Сначала отправь фото боту или укажи путь явно.'
            );
        }

        const filePath = path.join(compressedDir, jpgs[0]);
        console.log(`\nИспользую файл: ${filePath}\n`);
        return fs.readFile(filePath);
    }

    // URL: скачиваем
    if (input.startsWith('http://') || input.startsWith('https://')) {
        console.log(`\nСкачиваю изображение: ${input}\n`);
        const res = await fetch(input);
        if (!res.ok) throw new Error(`HTTP ${res.status} при скачивании изображения`);
        return Buffer.from(await res.arrayBuffer());
    }

    // Локальный путь
    const filePath = path.resolve(input);
    console.log(`\nЧитаю файл: ${filePath}\n`);
    return fs.readFile(filePath);
}

async function run() {
    const input = process.argv[2] || null;

    // Проверяем наличие ключа
    if (!process.env.OPENROUTER_API_KEY) {
        console.error('ОШИБКА: OPENROUTER_API_KEY не задан в .env');
        process.exit(1);
    }

    let adapter;
    try {
        adapter = createAiAdapter();
    } catch (e) {
        console.error('ОШИБКА создания адаптера:', e.message);
        process.exit(1);
    }

    console.log(`Провайдер: ${adapter.provider}`);
    console.log(`Модель: ${adapter.model}`);

    let imageBuffer;
    try {
        imageBuffer = await getImageBuffer(input);
    } catch (e) {
        console.error('ОШИБКА загрузки изображения:', e.message);
        process.exit(1);
    }

    console.log(`Размер изображения: ${imageBuffer.length} байт`);
    console.log('\nОтправляю запрос к AI...\n');

    const start = Date.now();
    let result;
    try {
        result = await adapter.analyzeImage(imageBuffer);
    } catch (e) {
        console.error('ОШИБКА AI-запроса:', e.message);
        process.exit(1);
    }

    const elapsed = Date.now() - start;

    console.log('=== Результат распознавания ===');
    console.log(`Продукт:   ${result.productName}`);
    console.log(`Белки:     ${result.proteins} г`);
    console.log(`Жиры:      ${result.fats} г`);
    console.log(`Углеводы:  ${result.carbs} г`);
    console.log(`Калории:   ${result.calories} ккал`);
    console.log(`Порция:    ${result.portionGrams} г`);
    console.log(`Уверенность: ${result.confidence}`);
    console.log(`\nВремя ответа: ${elapsed} мс`);
    console.log('\nСырой ответ AI:');
    console.log(result.aiRawResponse);
}

run();
