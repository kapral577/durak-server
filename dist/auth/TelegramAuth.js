"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramAuth = void 0;
// durak-server/auth/TelegramAuth.ts - СЕРВЕР - НОВЫЙ
const crypto_1 = __importDefault(require("crypto"));
class TelegramAuth {
    static validateInitData(initData) {
        try {
            const urlParams = new URLSearchParams(initData);
            const hash = urlParams.get('hash');
            if (!hash)
                return null;
            urlParams.delete('hash');
            // Создаем строку для проверки
            const dataCheckString = Array.from(urlParams.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');
            // Проверяем подпись
            const secretKey = crypto_1.default
                .createHmac('sha256', 'WebAppData')
                .update(this.BOT_TOKEN)
                .digest();
            const expectedHash = crypto_1.default
                .createHmac('sha256', secretKey)
                .update(dataCheckString)
                .digest('hex');
            if (hash !== expectedHash) {
                console.log('Invalid hash');
                return null;
            }
            // Проверяем время (данные не старше 24 часов)
            const authDate = parseInt(urlParams.get('auth_date') || '0');
            const currentTime = Math.floor(Date.now() / 1000);
            if (currentTime - authDate > 86400) { // 24 часа
                console.log('Data too old');
                return null;
            }
            // Извлекаем данные пользователя
            const userParam = urlParams.get('user');
            if (userParam) {
                return JSON.parse(userParam);
            }
            return null;
        }
        catch (error) {
            console.error('Telegram auth validation error:', error);
            return null;
        }
    }
    static generateAuthToken(telegramUser) {
        const payload = {
            telegramId: telegramUser.id,
            username: telegramUser.username,
            timestamp: Date.now()
        };
        // В реальном проекте используйте JWT
        return Buffer.from(JSON.stringify(payload)).toString('base64');
    }
}
exports.TelegramAuth = TelegramAuth;
TelegramAuth.BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
