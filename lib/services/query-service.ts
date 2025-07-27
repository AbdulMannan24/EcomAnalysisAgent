import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ClickHouseQueryTool } from '../database-tools';
import { QueryErrorHandler } from '../query-error-handler';
import { SchemaDebugger } from '../schema-debugger';
import { Logger } from '../logger';
import { FileManager } from '../utils/file-manager';
import { JSONParser } from '../utils/json-parser';
import { QueryValidationPrompts, QueryGenerationPrompts } from '../prompts';
import { AI_MODELS, TOKEN_LIMITS, SYSTEM_LIMITS } from '../config/constants';

export class QueryService {
  private queryTool: ClickHouseQueryTool;
  private errorHandler: QueryErrorHandler;
  private logger: Logger;
  private dataDir: string;

  constructor(logger: Logger, dataDir: string) {
    this.queryTool = new ClickHouseQueryTool();
    this.errorHandler = new QueryErrorHandler();
    this.logger = logger;
    this.dataDir = dataDir;
  }

  async validateQuery(userQuery: string, schemas: Map<string, any>): Promise<any> {
    if (!schemas || schemas.size === 0) {
      console.warn('No schemas available for validation');
      return {
        isValid: false,
        reason: 'No database schemas available',
        requiredTables: [],
        suggestedApproach: 'Please ensure database schemas are loaded'
      };
    }
    
    const tableSchemas = Object.fromEntries(schemas);
    const validationPrompt = QueryValidationPrompts.create(userQuery, tableSchemas);

    try {
      const result = await generateText({
        model: openai(AI_MODELS.VALIDATION),
        prompt: validationPrompt,
        maxTokens: TOKEN_LIMITS.VALIDATION
      });
      
      await this.logger.logModelCall(AI_MODELS.VALIDATION, validationPrompt, result.text);
      return JSONParser.parseAIResponse(result.text);
    } catch (error) {
      console.error('Query validation failed:', error);
      return {
        isValid: false,
        reason: 'Validation system error',
        requiredTables: [],
        suggestedApproach: 'Please try a simpler query'
      };
    }
  }

  async generateOptimizedQuery(userQuery: string, relevantSchemas: Record<string, any>): Promise<any> {
    const queryPrompt = QueryGenerationPrompts.create(userQuery, relevantSchemas);

    try {
      const result = await generateText({
        model: openai(AI_MODELS.QUERY_GENERATION),
        prompt: queryPrompt,
        maxTokens: TOKEN_LIMITS.QUERY_GENERATION
      });

      return JSONParser.parseAIResponse(result.text);
    } catch (error) {
      console.error('Query generation failed:', error);
      return {
        query: null,
        explanation: 'Failed to generate query',
        error: error.message
      };
    }
  }

  async executeQueryAndSave(
    queryObj: any, 
    sessionId: string, 
    schemas: Map<string, any>, 
    retryCount = 0
  ): Promise<any> {
    try {
      // Pre-execution validation to catch column issues
      if (schemas && schemas.size > 0) {
        const preValidationIssues = SchemaDebugger.validateTableColumns(queryObj.query, schemas);
        if (preValidationIssues.length > 0) {
          console.log('⚠️  Pre-execution validation found issues:', preValidationIssues);
        }
      }
      
      console.log('🔍 Executing query:', queryObj.query);
      
      const result = await this.queryTool.executeQuery(queryObj.query, null);
      await this.logger.logQuery(queryObj.query, result.success, result.data?.length || 0, result.error);
      
      if (!result.success && retryCount < SYSTEM_LIMITS.MAX_RETRIES) {
        if (this.errorHandler.shouldRetry(result.error)) {
          console.log(`⚠️  Query failed with retryable error: ${result.error}`);
          console.log('🔄 Attempting to fix and retry...');
          
          const fix = await this.errorHandler.fixSQLQuery(
            queryObj.query,
            result.error,
            schemas
          );
          
          await this.logger.logRetry('SQL_QUERY', retryCount + 1, result.error, fix.success);
          
          if (fix.success && fix.fixedQuery) {
            console.log('✨ Generated fixed query, retrying...');
            console.log(`📝 Fix explanation: ${fix.explanation}`);
            
            queryObj.query = fix.fixedQuery;
            return this.executeQueryAndSave(queryObj, sessionId, schemas, retryCount + 1);
          }
        }
      }
      
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          filepath: null,
          retryCount
        };
      }

      // Save query result
      const fileData = {
        timestamp: new Date().toISOString().replace(/[:.]/g, '-'),
        userQuery: queryObj.explanation,
        sqlQuery: queryObj.query,
        rowCount: result.rowCount,
        dataSize: JSON.stringify(result.data).length,
        data: result.data
      };

      const { filepath, filename, dataSize } = await FileManager.saveQueryResult(
        fileData, 
        sessionId, 
        this.dataDir
      );
      
      console.log(`💾 Saved query result: ${filename} (${result.rowCount} rows, ${Math.round(dataSize/1024)}KB)`);
      
      return {
        success: true,
        filepath,
        filename,
        dataFile: filepath,
        rowCount: result.rowCount,
        dataSize,
        data: result.data
      };
    } catch (error) {
      console.error('Query execution failed:', error);
      return {
        success: false,
        error: error.message,
        filepath: null
      };
    }
  }
}