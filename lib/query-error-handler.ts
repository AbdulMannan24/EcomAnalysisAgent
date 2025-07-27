//@ts-nocheck
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { ErrorFixingPrompts } from './prompts';
import { AI_MODELS, TOKEN_LIMITS } from './config';

export class QueryErrorHandler {
  constructor() {
    this.maxRetries = 3;
  }

  async fixSQLQuery(originalQuery: string, error: string, schemas: any): Promise<{
    success: boolean;
    fixedQuery?: string;
    explanation?: string;
  }> {
    const fixPrompt = ErrorFixingPrompts.create(originalQuery, error, schemas);

    try {
      const result = await generateText({
        model: openai(AI_MODELS.ERROR_FIXING),
        prompt: fixPrompt,
        maxTokens: TOKEN_LIMITS.ERROR_FIXING
      });

      const fixedQuery = result.text.trim()
        .replace(/^```sql\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      return {
        success: true,
        fixedQuery,
        explanation: this.analyzeError(error)
      };
    } catch (err) {
      console.error('Failed to fix SQL query:', err);
      return {
        success: false,
        explanation: 'Could not generate a fix for the SQL error'
      };
    }
  }

  analyzeError(error: string): string {
    if (error.includes('Unknown expression identifier') && (error.includes('inventory') || error.includes('unit_price'))) {
      return 'Column does not exist in referenced table - inventory columns are in dim_product/dim_variant, not fct_sales tables';
    }
    if (error.includes('Illegal type Float64 of first argument of function toFloat64OrNull')) {
      return 'Type conversion error - column is already Float64, remove toFloat64OrNull() and use column directly';
    }
    if (error.includes('Cannot convert NULL value to non-Nullable type')) {
      return 'NULL casting error - use toFloat64OrNull() or filter NULLs before casting';
    }
    if (error.includes('There is no supertype for types') && error.includes('UInt64') && error.includes('Int64')) {
      return 'Data type mismatch - need to cast columns to compatible types (String or UInt64)';
    }
    if (error.includes('There is no supertype for types') && error.includes('String') && error.includes('Int64')) {
      return 'String/Integer type mismatch - cast all columns to String in UNION';
    }
    if (error.includes('JOIN cannot infer common type') && error.includes('product_id')) {
      return 'JOIN type mismatch - need to cast product_id columns to String in JOIN condition';
    }
    if (error.includes('Unknown table expression identifier')) {
      return 'CTE syntax issue - ClickHouse requires specific WITH clause formatting';
    }
    if (error.includes('Syntax error')) {
      return 'SQL syntax incompatible with ClickHouse';
    }
    if (error.includes('Column') && error.includes('not found')) {
      return 'Column reference error - check table aliases and column names';
    }
    if (error.includes('GROUP BY')) {
      return 'GROUP BY clause issue - all non-aggregated columns must be included';
    }
    return 'Query execution error';
  }

  shouldRetry(error: string): boolean {
    // Determine if the error is retryable
    const retryableErrors = [
      'Unknown expression identifier',
      'Cannot convert NULL value to non-Nullable type',
      'There is no supertype for types',
      'JOIN cannot infer common type',
      'Illegal type Float64 of first argument of function toFloat64OrNull',
      'UInt64',
      'Int64',
      'String',
      'Unknown table expression identifier',
      'Syntax error',
      'Column .* not found',
      'GROUP BY',
      'HAVING',
      'DATE_SUB',
      'INTERVAL'
    ];

    return retryableErrors.some(pattern => error.includes(pattern));
  }
}