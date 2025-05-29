// durak-server/auth/TelegramAuth.ts - СЕРВЕР - НОВЫЙ
import crypto from 'crypto';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export class TelegramAuth {
  private static BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

  static validateInitData(initData: string): TelegramUser | null {
    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      
      if (!hash) return null;

      urlParams.delete('hash');
      
      // Создаем строку для проверки
      const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      // Проверяем подпись
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(this.BOT_TOKEN)
        .digest();
      
      const expectedHash = crypto
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
    } catch (error) {
      console.error('Telegram auth validation error:', error);
      return null;
    }
  }

  static generateAuthToken(telegramUser: TelegramUser): string {
    const payload = {
      telegramId: telegramUser.id,
      username: telegramUser.username,
      timestamp: Date.now()
    };
    
    // В реальном проекте используйте JWT
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }
}
