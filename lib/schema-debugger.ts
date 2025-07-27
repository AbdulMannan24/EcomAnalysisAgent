// @ts-nocheck
export class SchemaDebugger {
  static logSchemaInfo(schemas, logger) {
    console.log('\n🔍 DEBUGGING SCHEMA INFORMATION:');
    
    for (const [tableName, schema] of schemas.entries()) {
      console.log(`\n📋 Table: ${tableName}`);
      console.log(`   Columns (${schema.columns?.length || 0}):`);
      
      if (schema.columns) {
        schema.columns.forEach(col => {
          console.log(`   - ${col.name} (${col.type})`);
        });
      }
      
      if (logger) {
        logger.log('SCHEMA_DEBUG', `Table ${tableName} columns`, {
          tableName,
          columns: schema.columns || []
        });
      }
    }
    
    console.log('\n');
  }
  
  static formatSchemaForLLM(schemas) {
    const formatted = {};
    
    for (const [tableName, schema] of schemas.entries()) {
      formatted[tableName] = {
        description: `Table: ${tableName}`,
        columns: schema.columns?.map(col => ({
          name: col.name,
          type: col.type,
          description: `${col.name} - ${col.type}`
        })) || [],
        totalColumns: schema.columns?.length || 0
      };
    }
    
    return formatted;
  }
  
  static validateTableColumns(query, schemas) {
    const issues = [];
    
    try {
      // Extract table references from query
      const tableRefs = query.match(/FROM\s+(\w+\.\w+|\w+)/gi) || [];
      const joinRefs = query.match(/JOIN\s+(\w+\.\w+|\w+)/gi) || [];
      const allTableRefs = [...tableRefs, ...joinRefs];
      
      console.log('🔍 Pre-execution Query Analysis:');
      console.log('Table references found:', allTableRefs);
      
      // Check for common column issues that cause errors
      if (query.includes('inventory') && query.includes('fct_sales')) {
        issues.push('ERROR: inventory column referenced from fct_sales table - inventory is only in dim_variant');
      }
      
      if (query.includes('toFloat64OrNull') && query.includes('amount')) {
        // Check if amount column is already Float64
        for (const [tableName, schema] of schemas.entries()) {
          const amountCol = schema.columns?.find(col => col.name === 'amount');
          if (amountCol && (amountCol.type.includes('Float64') || amountCol.type.includes('Nullable(Float64)'))) {
            issues.push(`WARNING: toFloat64OrNull applied to ${tableName}.amount which is already ${amountCol.type}`);
          }
        }
      }
      
      // Check for missing table aliases when using JOINs
      if (query.includes('JOIN') && !query.includes(' AS ')) {
        issues.push('WARNING: Using JOINs without table aliases may cause ambiguous column references');
      }
      
      console.log('Pre-validation issues found:', issues.length);
      
    } catch (error) {
      console.log('Query validation error:', error.message);
    }
    
    return issues;
  }
}