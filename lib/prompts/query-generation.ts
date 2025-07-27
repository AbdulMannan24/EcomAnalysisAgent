import { PromptTemplate } from './template';

export class QueryGenerationPrompts {
  private static readonly CLICKHOUSE_RULES = `
CRITICAL ClickHouse Requirements:
- Use ClickHouse syntax, NOT standard SQL
- Date arithmetic: NOW() - toIntervalDay(30) instead of DATE_SUB()
- Avoid complex CTEs/WITH clauses - use subqueries in FROM instead
- GROUP BY must include ALL non-aggregated columns
- MANDATORY: For ALL JOINs, cast IDs to String for compatibility:
  * ALWAYS use: CAST(table1.product_id AS String) = CAST(table2.product_id AS String)
  * NEVER use: table1.product_id = table2.product_id (will fail with type errors)
- For UNION operations, cast ALL columns to same type:
  * Use toString(column) for strings (handles NULLs)
  * Use toFloat64OrNull(column) for nullable numerics
- SMART TYPE CONVERSION (CRITICAL):
  * Check column type BEFORE applying conversion functions
  * For Nullable(Float64) columns: Use direct column name, NOT toFloat64OrNull()
  * For String columns: Use column name directly, NOT toString()
  * For Integer->Float conversion: Use toFloat64OrNull(column) ONLY if source is Int/UInt
  * For NULL handling: Only add OrNull functions if column type shows Nullable()
  * NEVER apply toFloat64OrNull() to columns already typed as Float64 or Nullable(Float64)
- COLUMN VALIDATION:
  * NEVER reference columns that don't exist in a table
  * Check the exact column list above for each table
  * If you need inventory data, get it from dim_product or dim_variant tables
  * Sales tables (fct_sales, fct_webhook_sales) contain transaction data only
- Limit results to maximum 10000 rows
- Use appropriate LIMIT, ORDER BY for performance
- Include relevant columns only
- Add basic data validation (no NULL/empty critical fields)
- Handle potential empty results gracefully`;

  private static readonly TYPE_SAFETY_EXAMPLES = `
EXAMPLES of correct syntax:
- JOINs: ON CAST(t1.product_id AS String) = CAST(t2.product_id AS String)
- NULL-safe casting: toFloat64OrNull(total_cost) instead of CAST(total_cost AS Float64)
- String conversion: toString(currency_code) instead of CAST(currency_code AS String)`;

  static create(userQuery: string, relevantSchemas: Record<string, any>): string {
    const schemaInfo = PromptTemplate.formatSchemaForPrompt(new Map(Object.entries(relevantSchemas)));
    
    return `You are a ClickHouse SQL expert. Generate an optimized query for this request.

User Request: "${userQuery}"

CRITICAL DATABASE SCHEMA VALIDATION:
Before writing ANY query, you MUST verify column existence in the exact tables below.

${schemaInfo}

SCHEMA VALIDATION CHECKLIST:
□ Have you verified each column exists in the table you're selecting from?
□ Have you checked the exact data types before applying conversion functions?
□ Are you using the correct table for each piece of data (sales vs inventory)?

${this.CLICKHOUSE_RULES}

${this.TYPE_SAFETY_EXAMPLES}

Return JSON:
{
  "query": "optimized SQL query",
  "explanation": "what this query does",
  "estimatedRows": estimated_number,
  "dataPreview": "brief description of expected output"
}`;
  }
}