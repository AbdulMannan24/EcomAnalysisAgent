import { PromptTemplate } from './template';

export class QueryValidationPrompts {
  static create(userQuery: string, tableSchemas: Record<string, any>): string {
    const keyColumnMappings = Object.entries(tableSchemas)
      .map(([tableName, schema]) => {
        const columns = schema.columns || [];
        const keyColumns = columns.filter((col: any) => 
          col.name.includes('product') || 
          col.name.includes('inventory') || 
          col.name.includes('price') || 
          col.name.includes('amount') ||
          col.name.includes('shop') ||
          col.name.includes('revenue')
        );
        return `${tableName}: ${keyColumns.map((col: any) => `${col.name}(${col.type})`).join(', ')}`;
      })
      .join('\n');

    return `You are a database query validator. Analyze if this user query can be answered with the available database schema.

User Query: "${userQuery}"

IMPORTANT SCHEMA UNDERSTANDING:
- Sales transaction data: cortex_3_facts.fct_sales, cortex_3_facts.fct_webhook_sales
- Product metadata: cortex_2_dimensions.dim_product 
- Inventory data: cortex_2_dimensions.dim_variant (has inventory columns)
- Store/shop data: Available in sales tables as 'shop' column

CRITICAL COLUMN MAPPINGS:
${keyColumnMappings}

Validate based on:
1. Can the query be answered with available columns?
2. Are the required data relationships possible with JOINs?
3. Does the user need inventory data (only in dim_variant)?
4. Does the user need sales data (in fct_sales/fct_webhook_sales)?

Respond with JSON:
{
  "isValid": boolean,
  "requiredTables": [array of table names needed],
  "reason": "explanation with specific column availability",
  "suggestedApproach": "how to approach this query with correct tables/columns",
  "columnMappings": {
    "inventory": "dim_variant.inventory",
    "sales": "fct_sales.amount", 
    "revenue": "calculated from amount * unit_price"
  }
}`;
  }
}