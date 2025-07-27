import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';

dotenv.config();

// Base configuration for ClickHouse client
const getClickHouseClient = () => {
  return createClient({
    url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    application: 'ai-analytics-agent',
  });
};

export class ClickHouseQueryTool {
  private client;

  constructor() {
    this.client = getClickHouseClient();
  }

  async executeQuery(query, database) {
    try {
      // Modify query to include database if provided
      let finalQuery = query;
      if (database && !query.toLowerCase().includes('from system.') && !query.toLowerCase().includes('show ')) {
        // Replace table references with database.table format
        finalQuery = query.replace(/FROM\s+(\w+)/gi, `FROM ${database}.$1`);
        finalQuery = finalQuery.replace(/JOIN\s+(\w+)/gi, `JOIN ${database}.$1`);
      }
      
      const result = await this.client.query({
        query: finalQuery,
        format: 'JSONEachRow',
      });

      const data = await result.json();
      
      return {
        success: true,
        data,
        rowCount: Array.isArray(data) ? data.length : 0,
        query: finalQuery,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        query,
      };
    }
  }
}

export class ClickHouseTableInfoTool {
  private client;

  constructor() {
    this.client = getClickHouseClient();
  }

  async getTableInfo(tableName, database) {
    try {
      // Get essential table structure (columns and types only)
      const columnsQuery = `
        SELECT 
          name,
          type
        FROM system.columns
        WHERE table = '${tableName}'
        ${database ? `AND database = '${database}'` : ''}
        ORDER BY position
      `;

      const columnsResult = await this.client.query({
        query: columnsQuery,
        format: 'JSONEachRow',
      });

      const columns = await columnsResult.json();

      return {
        success: true,
        table: tableName,
        database: database || 'default',
        columns,
        columnsCount: columns.length,
      };
    } catch (error) {
      console.warn(`Failed to get table info for ${tableName}:`, error.message);
      return {
        success: false,
        error: error.message,
        tableName,
      };
    }
  }

  async listTables(database) {
    try {
      const query = `SHOW TABLES FROM ${database}`;

      const result = await this.client.query({
        query,
        format: 'JSONEachRow',
      });

      const tables = await result.json();

      return {
        success: true,
        database: database,
        tables: tables.map((t) => t.name || Object.values(t)[0]),
      };
    } catch (error) {
      console.warn(`Failed to list tables from ${database}:`, error.message);
      return {
        success: false,
        error: error.message,
        database,
      };
    }
  }
}