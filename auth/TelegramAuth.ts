// durak-server/auth/TelegramAuth.ts - РЕФАКТОРИРОВАННАЯ ВЕРСИЯ

import crypto from 'crypto';
import { TelegramUser, TelegramInitData } from '../shared/types';

// ===== КОНСТАНТЫ =====
const AUTH_VALIDITY_HOURS = 24;
const AUTH_VALIDITY_SECONDS = AUTH_VALIDITY_HOURS * 60 * 60;

interface AuthTokenPayload {
  telegramId: number;
  username?: string;
  timestamp: number;
  exp: number; // expiration timestamp
}

export class TelegramAuth {
  private static BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

  /**
   * Валидирует Telegram WebApp initData согласно официальной документации
   */
  static validateInitData(initData: string): TelegramUser | null {
    if (!this.BOT_TOKEN) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('TELEGRAM_BOT_TOKEN not configured - using mock validation');
        return this.getMockUser();
      }
      return null;
    }

    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      
      if (!hash) {
        return null;
      }

      urlParams.delete('hash');

      // Создаем строку для проверки согласно Telegram документации
      const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      // Проверяем HMAC подпись
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(this.BOT_TOKEN)
        .digest();

      const expectedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      if (hash !== expectedHash) {
        return null;
      }

      // Проверяем время (данные не старше 24 часов)
      const authDate = parseInt(urlParams.get('auth_date') || '0');
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (currentTime - authDate > AUTH_VALIDITY_SECONDS) {
        return null;
      }

      // Извлекаем и валидируем данные пользователя
      const userParam = urlParams.get('user');
      if (!userParam) {
        return null;
      }

      const userData = JSON.parse(userParam);
      
      // Валидируем структуру пользователя
      if (!this.isValidTelegramUser(userData)) {
        return null;
      }

      return userData;

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Telegram auth validation error:', error);
      }
      return null;
    }
  }

  /**
   * Генерирует безопасный auth токен
   */
  static generateAuthToken(telegramUser: TelegramUser): string {
    const now = Date.now();
    const payload: AuthTokenPayload = {
      telegramId: telegramUser.id,
      username: telegramUser.username,
      timestamp: now,
      exp: now + (AUTH_VALIDITY_HOURS * 60 * 60 * 1000), // 24 часа
    };

    // В production используйте proper JWT библиотеку
    const tokenData = JSON.stringify(payload);
    const signature = this.createTokenSignature(tokenData);
    
    return Buffer.from(`${tokenData}.${signature}`).toString('base64');
  }

  /**
   * Валидирует auth токен
   */
  static validateAuthToken(token: string): AuthTokenPayload | null {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [tokenData, signature] = decoded.split('.');
      
      if (!tokenData || !signature) {
        return null;
      }

      // Проверяем подпись
      const expectedSignature = this.createTokenSignature(tokenData);
      if (signature !== expectedSignature) {
        return null;
      }

      const payload: AuthTokenPayload = JSON.parse(tokenData);
      
      // Проверяем срок действия
      if (Date.now() > payload.exp) {
        return null;
      }

      return payload;

    } catch (error) {
      return null;
    }
  }

  /**
   * Извлекает Telegram ID из токена
   */
  static getTelegramIdFromToken(token: string): number | null {
    const payload = this.validateAuthToken(token);
    return payload?.telegramId || null;
  }

  /**
   * Проверяет актуальность auth_date
   */
  static isAuthDateValid(authDate: number): boolean {
    const currentTime = Math.floor(Date.now() / 1000);
    return (currentTime - authDate) < AUTH_VALIDITY_SECONDS;
  }

  /**
   * Mock пользователь для разработки
   */
  private static getMockUser(): TelegramUser {
    return {
      id: 123456789,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      language_code: 'ru',
    };
  }

  /**
   * Валидирует структуру TelegramUser
   */
  private static isValidTelegramUser(user: any): user is TelegramUser {
    return (
      user &&
      typeof user.id === 'number' &&
      typeof user.first_name === 'string' &&
      user.first_name.length > 0
    );
  }

  /**
   * Создает подпись для токена
   */
  private static createTokenSignature(data: string): string {
    const secret = this.BOT_TOKEN || 'development-secret';
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }
}
