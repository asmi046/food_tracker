const { createOpenrouterAdapter } = require('./openrouterAdapter');
const { createOpenaiAdapter } = require('./openaiAdapter');

// Фабрика: создает нужный адаптер по переменным окружения
// Сейчас один провайдер (openrouter), в будущем можно добавить другие
function createAiAdapter() {
    const provider = process.env.AI_PROVIDER || 'openrouter';

    if (provider === 'openrouter') {
        return createOpenrouterAdapter({
            apiKey: process.env.OPENROUTER_API_KEY,
            model: process.env.OPENROUTER_MODEL,
        });
    }

    if (provider === 'openai') {
        return createOpenaiAdapter({
            apiKey: process.env.OPENAI_API_KEY,
            model: process.env.OPENAI_MODEL,
        });
    }

    throw new Error(`Unknown AI provider: "${provider}". Supported: openrouter, openai`);
}

module.exports = {
    createAiAdapter,
};
