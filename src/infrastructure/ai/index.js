const { createOpenrouterAdapter } = require('./openrouterAdapter');

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

    throw new Error(`Unknown AI provider: "${provider}". Supported: openrouter`);
}

module.exports = {
    createAiAdapter,
};
