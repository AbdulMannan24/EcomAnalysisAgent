import { ClickHouseTableInfoTool } from '../database-tools';
import { Logger } from '../logger';
import { SchemaDebugger } from '../schema-debugger';

export class SchemaService {
  private schemas: Map<string, any> = new Map();
  private tableTool: ClickHouseTableInfoTool;
  private logger: Logger;

  constructor(logger: Logger) {
    this.tableTool = new ClickHouseTableInfoTool();
    this.logger = logger;
  }

  async cacheSchemas(databases: string[]): Promise<void> {
    try {
      console.log('📊 Fetching database schemas...');
      
      if (!databases || databases.length === 0) {
        console.warn('⚠️  No databases specified in DATABASES environment variable');
        return;
      }

      console.log(`📋 Processing ${databases.length} database(s): ${databases.join(', ')}`);

      for (const database of databases) {
        console.log(`🔍 Processing database: ${database}`);
        
        const tablesResult = await this.tableTool.listTables(database);
        if (!tablesResult.success) {
          console.warn(`Could not fetch tables from ${database}:`, tablesResult.error);
          continue;
        }

        console.log(`📋 Found ${tablesResult.tables.length} tables in ${database}`);

        for (const tableName of tablesResult.tables) {
          try {
            const tableInfo = await this.tableTool.getTableInfo(tableName, database);
            if (tableInfo.success) {
              const schemaKey = `${database}.${tableName}`;
              this.schemas.set(schemaKey, tableInfo);
              console.log(`✓ Cached schema for: ${schemaKey} (${tableInfo.columns?.length || 0} columns)`);
            } else {
              console.warn(`⚠️  Could not get schema for ${database}.${tableName}: ${tableInfo.error}`);
            }
          } catch (error) {
            console.warn(`❌ Failed to cache schema for ${database}.${tableName}:`, error.message);
          }
        }
      }
      
      console.log(`📚 Cached ${this.schemas.size} table schemas`);
    } catch (error) {
      console.error('Schema caching failed:', error);
    }
  }

  getSchemas(): Map<string, any> {
    return this.schemas;
  }

  getRelevantSchemas(requiredTables: string[]): Record<string, any> {
    const relevantSchemas: Record<string, any> = {};
    requiredTables.forEach(table => {
      if (this.schemas.has(table)) {
        relevantSchemas[table] = this.schemas.get(table);
      }
    });
    return relevantSchemas;
  }

  debugSchemaInfo(relevantSchemas: Record<string, any>): void {
    console.log('\n🔍 SCHEMA DEBUG: Relevant tables for query generation:');
    SchemaDebugger.logSchemaInfo(new Map(Object.entries(relevantSchemas)), this.logger);
  }
}