import dotenv from 'dotenv';

dotenv.config();

export class Environment {
  static get databases(): string[] {
    return process.env.DATABASES?.split(',') || [];
  }

  static get clickhouse() {
    return {
      host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
      user: process.env.CLICKHOUSE_USER || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || ''
    };
  }

  static get openai() {
    return {
      apiKey: process.env.OPENAI_API_KEY
    };
  }

  static validate(): { valid: boolean; missing: string[] } {
    const required = ['DATABASES', 'CLICKHOUSE_HOST', 'OPENAI_API_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    return {
      valid: missing.length === 0,
      missing
    };
  }
}