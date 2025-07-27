export class ErrorFixingPrompts {
  private static readonly COMMON_FIXES = `
Common ClickHouse issues to consider:
1. Type casting for JOINs: Use CAST(table1.product_id AS String) = CAST(table2.product_id AS String)
2. UNION type compatibility: Cast all columns to same type
3. CTEs (WITH clauses) must be properly formatted for ClickHouse
4. Use toIntervalDay() instead of INTERVAL syntax
5. Date functions: NOW() - toIntervalDay(30) instead of DATE_SUB
6. GROUP BY requires all non-aggregated columns
7. HAVING clause works differently in ClickHouse

CRITICAL: For data type errors (UInt64/Int64 mismatch):
- Fix JOINs: ON CAST(t1.product_id AS String) = CAST(t2.product_id AS String)
- Fix UNIONs: SELECT CAST(column AS UInt64) or CAST(column AS String)

CRITICAL: For NULL casting errors and type mismatches:
- ONLY use toFloat64OrNull() for Int/UInt columns that may be NULL
- For Float64 or Nullable(Float64) columns: Use column name directly, NO conversion needed
- For String columns: Use column name directly, NO toString() needed
- Check column types in schema before applying any conversion functions

ClickHouse TYPE-SAFE casting patterns:
- If column is already Float64/Nullable(Float64): Use column_name (no conversion)
- If column is Int/UInt and nullable: Use toFloat64OrNull(column_name)
- If column is String: Use column_name (no toString() needed)
- For inventory data: Must use dim_variant table, NOT fct_sales

CRITICAL COLUMN LOCATION FIXES:
- inventory columns: Only in dim_variant table
- sales amount: In fct_sales/fct_webhook_sales tables
- product info: In dim_product table`;

  static create(originalQuery: string, error: string, schemas: any): string {
    return `You are a ClickHouse SQL expert. A query failed with an error and needs to be fixed.

Original Query:
${originalQuery}

Error Message:
${error}

Database Schema Summary:
${JSON.stringify(schemas, null, 2)}

${this.COMMON_FIXES}

Please provide a corrected query that will work in ClickHouse. Fix the column locations and remove unnecessary type conversions. Return ONLY the SQL query, no explanation.`;
  }
}