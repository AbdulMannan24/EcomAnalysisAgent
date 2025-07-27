// @ts-nocheck
import dotenv from 'dotenv';
import { ClickHouseQueryTool, ClickHouseTableInfoTool } from './database-tools';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { ScriptValidator } from './script-validator';
import { QueryErrorHandler } from './query-error-handler';
import { Logger } from './logger';
import { SchemaDebugger } from './schema-debugger';

dotenv.config();
const databases = process.env.DATABASES?.split(',');

// Robust JSON parsing helper with multiple fallback strategies
function parseAIResponse(text) {
  let cleanResponse = text.trim();
  
  // Strategy 1: Remove markdown code blocks
  if (cleanResponse.startsWith('```')) {
    cleanResponse = cleanResponse.replace(/^```json\s*/m, '').replace(/\s*```$/m, '');
  }
  
  // Strategy 2: Find JSON object boundaries
  const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanResponse = jsonMatch[0];
  }
  
  // Strategy 3: Remove any trailing text after JSON
  const lastBraceIndex = cleanResponse.lastIndexOf('}');
  if (lastBraceIndex !== -1) {
    cleanResponse = cleanResponse.substring(0, lastBraceIndex + 1);
  }
  
  // Strategy 4: Fix common JSON issues
  cleanResponse = cleanResponse
    .replace(/,\s*}/g, '}')  // Remove trailing commas
    .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
    .replace(/\n/g, ' ')     // Replace newlines with spaces
    .replace(/\t/g, ' ')     // Replace tabs with spaces
    .replace(/\s+/g, ' ');   // Normalize whitespace
  
  try {
    return JSON.parse(cleanResponse);
  } catch (parseError) {
    console.warn('Primary JSON parse failed, attempting repair...', parseError.message);
    
    // Strategy 5: Try to extract and fix JSON structure
    try {
      // Find the first { and last }
      const firstBrace = cleanResponse.indexOf('{');
      const lastBrace = cleanResponse.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const extractedJson = cleanResponse.substring(firstBrace, lastBrace + 1);
        return JSON.parse(extractedJson);
      }
    } catch (repairError) {
      console.error('JSON repair failed:', repairError.message);
      console.error('Raw AI response length:', text.length);
      console.error('First 500 chars:', text.substring(0, 500));
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }
    
    throw parseError;
  }
}


export class AnalyticsAgent {
  constructor() {
    this.schemas = new Map();
    this.dataDir = path.join(process.cwd(), 'data');
    this.queryTool = new ClickHouseQueryTool();
    this.tableTool = new ClickHouseTableInfoTool();
    this.validator = new ScriptValidator();
    this.errorHandler = new QueryErrorHandler();
    this.logger = new Logger();
    this.initialized = false;
    
    // Query limits
    this.MAX_ROWS = 10000;
    this.MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    this.OPENAI_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB for OpenAI
    this.QUERY_TIMEOUT = 30000; // 30 seconds
  }

  async initialize() {
    if (this.initialized) return;
    
    console.log('🚀 Initializing Analytics Agent...');
    
    // Create data directory
    await this.ensureDataDirectory();
    
    // Check Python dependencies
    const depCheck = await this.validator.checkDependencies();
    if (depCheck.missing.length > 0) {
      console.log('📦 Installing missing Python packages:', depCheck.missing.join(', '));
      const installResult = await this.validator.installMissingDependencies(depCheck.missing);
      if (!installResult.success) {
        console.error('❌ Failed to install dependencies:', installResult.error);
        console.log('💡 Please install manually: pip3 install', depCheck.missing.join(' '));
      }
    }
    
    // Fetch and cache all database schemas
    await this.cacheSchemas();
    
    this.initialized = true;
    console.log('✅ Analytics Agent initialized successfully');
  }

  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'queries'), { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'analysis'), { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'scripts'), { recursive: true });
    } catch (error) {
      console.warn('Data directory creation warning:', error.message);
    }
  }

  async cacheSchemas() {
    try {
      console.log('📊 Fetching database schemas...');
      
      // Get databases from environment
      if (!databases || databases.length === 0) {
        console.warn('No databases specified in DATABASES environment variable');
        return;
      }

      // Iterate through each database
      for (const database of databases) {
        console.log(`🔍 Processing database: ${database}`);
        
        // Get all tables in this database
        const tablesResult = await this.tableTool.listTables(database);
        if (!tablesResult.success) {
          console.warn(`Could not fetch tables from ${database}:`, tablesResult.error);
          continue;
        }

        console.log(`📋 Found ${tablesResult.tables.length} tables in ${database}`);

        // Cache schema for each table
        for (const tableName of tablesResult.tables) {
          try {
            const tableInfo = await this.tableTool.getTableInfo(tableName, database);
            if (tableInfo.success) {
              const schemaKey = `${database}.${tableName}`;
              this.schemas.set(schemaKey, tableInfo);
              console.log(`✓ Cached schema for: ${schemaKey} (${tableInfo.columns?.length || 0} columns)`);
            }
          } catch (error) {
            console.warn(`Failed to cache schema for ${database}.${tableName}:`, error.message);
          }
        }
      }
      
      console.log(`📚 Cached ${this.schemas.size} table schemas`);
    } catch (error) {
      console.error('Schema caching failed:', error);
    }
  }

  async validateQuery(userQuery) {
    const availableTables = Array.from(this.schemas.keys());
    const tableSchemas = Object.fromEntries(this.schemas);
    
    // Enhanced validation with column mapping guidance
    const validationPrompt = `
You are a database query validator. Analyze if this user query can be answered with the available database schema.

User Query: "${userQuery}"

IMPORTANT SCHEMA UNDERSTANDING:
- Sales transaction data: cortex_3_facts.fct_sales, cortex_3_facts.fct_webhook_sales
- Product metadata: cortex_2_dimensions.dim_product 
- Inventory data: cortex_2_dimensions.dim_variant (has inventory columns)
- Store/shop data: Available in sales tables as 'shop' column

CRITICAL COLUMN MAPPINGS:
${Object.entries(tableSchemas).map(([tableName, schema]) => {
  const columns = schema.columns || [];
  const keyColumns = columns.filter(col => 
    col.name.includes('product') || 
    col.name.includes('inventory') || 
    col.name.includes('price') || 
    col.name.includes('amount') ||
    col.name.includes('shop') ||
    col.name.includes('revenue')
  );
  return `${tableName}: ${keyColumns.map(col => `${col.name}(${col.type})`).join(', ')}`;
}).join('\n')}

Available Tables and Complete Schemas:
${JSON.stringify(tableSchemas, null, 2)}

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

    try {
      const result = await generateText({
        model: openai('gpt-4o-mini'),
        prompt: validationPrompt,
        maxTokens: 800
      });
      
      await this.logger.logModelCall('gpt-4o-mini', validationPrompt, result.text);

      return parseAIResponse(result.text);
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

  async generateOptimizedQuery(userQuery, validation) {
    const relevantSchemas = {};
    validation.requiredTables.forEach(table => {
      if (this.schemas.has(table)) {
        relevantSchemas[table] = this.schemas.get(table);
      }
    });

    // Debug schema information
    console.log('\n🔍 SCHEMA DEBUG: Relevant tables for query generation:');
    SchemaDebugger.logSchemaInfo(new Map(Object.entries(relevantSchemas)), this.logger);

    const queryPrompt = `
You are a ClickHouse SQL expert. Generate an optimized query for this request.

User Request: "${userQuery}"

CRITICAL DATABASE SCHEMA VALIDATION:
Before writing ANY query, you MUST verify column existence in the exact tables below.

${Object.entries(relevantSchemas).map(([tableName, schema]) => {
  const columns = schema.columns || [];
  const columnsByType = columns.reduce((acc, col) => {
    const baseType = col.type.replace(/Nullable\(|\)/g, '').split('(')[0];
    if (!acc[baseType]) acc[baseType] = [];
    acc[baseType].push(col.name);
    return acc;
  }, {});
  
  return `═══ TABLE: ${tableName} ═══
AVAILABLE COLUMNS (${columns.length} total):
${columns.map(col => `  ✓ ${col.name} (${col.type})`).join('\n')}

COLUMNS BY DATA TYPE:
${Object.entries(columnsByType).map(([type, cols]) => `  ${type}: ${cols.join(', ')}`).join('\n')}

❌ COLUMNS THAT DO NOT EXIST: If you need inventory data, this table does NOT have it.
❌ DO NOT reference columns not listed above - they will cause errors.`;
}).join('\n\n')}

SCHEMA VALIDATION CHECKLIST:
□ Have you verified each column exists in the table you're selecting from?
□ Have you checked the exact data types before applying conversion functions?
□ Are you using the correct table for each piece of data (sales vs inventory)?

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
- Limit results to maximum ${this.MAX_ROWS} rows
- Use appropriate LIMIT, ORDER BY for performance
- Include relevant columns only
- Add basic data validation (no NULL/empty critical fields)
- Handle potential empty results gracefully

EXAMPLES of correct syntax:
- JOINs: ON CAST(t1.product_id AS String) = CAST(t2.product_id AS String)
- NULL-safe casting: toFloat64OrNull(total_cost) instead of CAST(total_cost AS Float64)
- String conversion: toString(currency_code) instead of CAST(currency_code AS String)

Return JSON:
{
  "query": "optimized SQL query",
  "explanation": "what this query does",
  "estimatedRows": estimated_number,
  "dataPreview": "brief description of expected output"
}`;

    try {
      const result = await generateText({
        model: openai('gpt-4o-mini'),
        prompt: queryPrompt,
        maxTokens: 800
      });

      return parseAIResponse(result.text);
    } catch (error) {
      console.error('Query generation failed:', error);
      return {
        query: null,
        explanation: 'Failed to generate query',
        error: error.message
      };
    }
  }

  async executeQueryAndSave(queryObj, sessionId, retryCount = 0) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `query_${sessionId}_${timestamp}.json`;
    const filepath = path.join(this.dataDir, 'queries', filename);

    try {
      // Pre-execution validation to catch column issues
      const preValidationIssues = SchemaDebugger.validateTableColumns(queryObj.query, this.schemas);
      if (preValidationIssues.length > 0) {
        console.log('⚠️  Pre-execution validation found issues:', preValidationIssues);
      }
      
      console.log('🔍 Executing query:', queryObj.query);
      
      const result = await this.queryTool.executeQuery(queryObj.query);
      await this.logger.logQuery(queryObj.query, result.success, result.data?.length || 0, result.error);
      
      if (!result.success && retryCount < 3) {
        // Check if error is retryable
        if (this.errorHandler.shouldRetry(result.error)) {
          console.log(`⚠️  Query failed with retryable error: ${result.error}`);
          console.log('🔄 Attempting to fix and retry...');
          
          // Get fixed query from LLM
          const fix = await this.errorHandler.fixSQLQuery(
            queryObj.query,
            result.error,
            this.schemas
          );
          
          await this.logger.logRetry('SQL_QUERY', retryCount + 1, result.error, fix.success);
          
          if (fix.success && fix.fixedQuery) {
            console.log('✨ Generated fixed query, retrying...');
            console.log(`📝 Fix explanation: ${fix.explanation}`);
            
            // Retry with fixed query
            queryObj.query = fix.fixedQuery;
            return this.executeQueryAndSave(queryObj, sessionId, retryCount + 1);
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

      // Check file size limits
      const dataSize = JSON.stringify(result.data).length;
      if (dataSize > this.MAX_FILE_SIZE) {
        return {
          success: false,
          error: `Data size (${Math.round(dataSize/1024/1024)}MB) exceeds limit (${Math.round(this.MAX_FILE_SIZE/1024/1024)}MB)`,
          filepath: null
        };
      }

      // Save query result
      const fileData = {
        timestamp,
        userQuery: queryObj.explanation,
        sqlQuery: queryObj.query,
        rowCount: result.rowCount,
        dataSize: dataSize,
        data: result.data
      };

      await fs.writeFile(filepath, JSON.stringify(fileData, null, 2));
      
      console.log(`💾 Saved query result: ${filename} (${result.rowCount} rows, ${Math.round(dataSize/1024)}KB)`);
      
      return {
        success: true,
        filepath,
        filename,
        dataFile: filepath,  // Add this for consistency
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

  async generateAnalysisStrategy(queryResult, userQuery) {
    // Enhanced data sampling to prevent token limits
    const MAX_SAMPLE_SIZE = 30;
    const MAX_STRING_LENGTH = 80;
    const MAX_CHARS_PER_SAMPLE = 8000; // Conservative limit for AI context
    
    let sampleData = queryResult.data || [];
    
    // Handle empty data gracefully
    if (sampleData.length === 0) {
      console.log('⚠️  No data returned from query, providing basic analysis');
      return {
        insights: {
          immediate: ["No data found for the specified criteria"],
          statistical: ["Query returned 0 rows - possibly due to strict filters"],
          business: ["Consider adjusting date ranges or criteria"]
        },
        pythonScript: {
          description: "Data validation script",
          code: "# No data to analyze\\nprint('Query returned no results')",
          outputFiles: []
        },
        recommendations: [
          "Check if data exists for the specified time period",
          "Verify table relationships and filters",
          "Try a broader date range or different criteria"
        ],
        followUpQuestions: [
          "What time period should we analyze?", 
          "Are there other related metrics to explore?"
        ]
      };
    }
    
    // Smart sampling: take start, middle, end
    if (sampleData.length > MAX_SAMPLE_SIZE) {
      const third = Math.floor(MAX_SAMPLE_SIZE / 3);
      const start = sampleData.slice(0, third);
      const middle = sampleData.slice(Math.floor(sampleData.length / 2) - Math.floor(third/2), Math.floor(sampleData.length / 2) + Math.floor(third/2));
      const end = sampleData.slice(-third);
      sampleData = [...start, ...middle, ...end];
      console.log(`📊 Using representative sample: ${sampleData.length} rows from ${queryResult.rowCount} total`);
    }
    
    // Truncate long strings
    const processedSample = sampleData.map(row => {
      const processed = {};
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
          processed[key] = value.substring(0, MAX_STRING_LENGTH) + '...';
        } else {
          processed[key] = value;
        }
      }
      return processed;
    });

    const analysisPrompt = `
You are a data analysis expert. Create a custom analysis strategy tailored to the user's specific requirements.

User Query: "${userQuery}"
Data Sample (${processedSample.length} rows from ${queryResult.rowCount} total):
${JSON.stringify(processedSample, null, 2)}

Based on the user's specific request and the data structure, create a comprehensive and customized analysis.

Generate a JSON response with:
{
  "insights": {
    "immediate": ["Key insights visible in the data"],
    "statistical": ["Statistical patterns and metrics relevant to the query"],
    "business": ["Business implications and actionable insights"]
  },
  "pythonScript": {
    "description": "Detailed description of what the custom script will accomplish",
    "code": "Custom Python script specifically designed for this user's requirements",
    "outputFiles": ["list of specific files that will be generated"]
  },
  "recommendations": ["Specific actionable recommendations based on the data"],
  "followUpQuestions": ["Relevant follow-up questions based on the analysis"]
}

CRITICAL REQUIREMENTS for the custom Python script:
1. The dataframe 'df' is already loaded with the query results
2. All imports are available (pandas as pd, matplotlib.pyplot as plt, seaborn as sns, numpy as np, os)
3. Use 'output_dir' for all file saves: os.path.join(output_dir, 'filename.ext')
4. Handle NULL values and data type conversions with proper error handling
5. Create visualizations and analysis appropriate for the specific data and user request
6. If user asks for reports, create professional stakeholder-ready output
7. Include comprehensive data validation and cleaning for the specific dataset

IMPORTANT: Design the script specifically for this user's request:
- Analyze the exact metrics they asked for
- Create appropriate visualizations for the data type
- Generate professional output suitable for stakeholders if requested
- Handle edge cases and potential data issues
- Be creative and comprehensive, not templated

Write a complete, working Python script that addresses all aspects of the user's query.`;

    let attempt = 0;
    const maxAttempts = 3;
    
    while (attempt < maxAttempts) {
      try {
        console.log(`📝 Generating analysis strategy (attempt ${attempt + 1}/${maxAttempts})...`);
        
        const result = await generateText({
          model: openai('gpt-4o'),
          prompt: analysisPrompt,
          maxTokens: 2000
        });

        await this.logger.logModelCall('gpt-4o', analysisPrompt, result.text);
        const strategy = parseAIResponse(result.text);
        
        // Validate the generated Python script
        if (strategy.pythonScript?.code) {
          const validation = await this.validator.validatePythonScript(strategy.pythonScript.code);
          
          if (validation.valid) {
            console.log('✅ Generated Python script passed validation');
            return strategy;
          } else {
            console.log(`⚠️  Python script validation failed: ${validation.errors.join(', ')}`);
            
            if (attempt < maxAttempts - 1) {
              console.log('🔄 Regenerating script with validation feedback...');
              analysisPrompt += `\n\nIMPORTANT: Previous script had these issues: ${validation.errors.join(', ')}. Please fix these in the new script.`;
              attempt++;
              continue;
            }
          }
        }
        
        return strategy;
      } catch (error) {
        console.error(`❌ Analysis strategy generation failed (attempt ${attempt + 1}):`, error.message);
        
        if (attempt < maxAttempts - 1) {
          attempt++;
          continue;
        }
        
        return this.getFallbackAnalysisStrategy(userQuery, queryResult, error.message);
      }
    }
    
    return this.getFallbackAnalysisStrategy(userQuery, queryResult, 'Max attempts reached');
  }
  
  // Fallback analysis strategy when AI fails
  getFallbackAnalysisStrategy(userQuery, queryResult, errorMessage) {
    console.log('🔄 Using fallback analysis strategy');
    
    const rowCount = queryResult?.rowCount || 0;
    const hasData = rowCount > 0;
    
    // Determine query type for better fallback insights
    const queryLower = userQuery.toLowerCase();
    const isTopQuery = queryLower.includes('top') || queryLower.includes('best') || queryLower.includes('highest');
    const isTrendQuery = queryLower.includes('trend') || queryLower.includes('over time') || queryLower.includes('month');
    const isCompareQuery = queryLower.includes('compare') || queryLower.includes('versus') || queryLower.includes('between');
    const isSalesQuery = queryLower.includes('sales') || queryLower.includes('revenue') || queryLower.includes('selling');
    
    const insights = {
      immediate: hasData ? [
        `Found ${rowCount} records matching your criteria`,
        isTopQuery ? 'Results ranked by performance metrics' :
        isSalesQuery ? 'Sales data aggregated and ready for analysis' :
        'Data successfully retrieved and processed'
      ] : [
        "No data found for the specified criteria",
        "Query executed successfully but returned empty results"
      ],
      statistical: hasData ? [
        `Dataset contains ${rowCount} rows of data`,
        'Data aggregation and grouping completed successfully',
        'Raw statistics available for detailed analysis'
      ] : [
        'Query returned 0 rows - possibly due to restrictive filters',
        'Consider broadening search criteria or date ranges'
      ],
      business: hasData ? [
        isTopQuery ? 'Top performers identified - focus on highest-ranking results' :
        isTrendQuery ? 'Time-based data available for trend analysis' :
        isCompareQuery ? 'Comparative metrics ready for business insights' :
        isSalesQuery ? 'Sales performance data ready for revenue analysis' :
        'Business metrics extracted and ready for strategic decisions'
      ] : [
        'No business insights available due to empty dataset',
        'Recommend adjusting query parameters to capture relevant data'
      ]
    };
    
    const recommendations = hasData ? [
      'Review the detailed results in the saved data file',
      'Use the data table to identify key patterns and outliers',
      isTopQuery ? 'Focus strategic efforts on the top-performing items' :
      isSalesQuery ? 'Analyze revenue trends to optimize sales strategies' :
      'Look for actionable insights in the numerical data',
      'Consider creating visualizations for better understanding'
    ] : [
      'Try expanding the date range (e.g., last 30 days instead of 10)',
      'Check if the specified filters are too restrictive',
      'Verify that data exists for the selected time period',
      'Consider using broader search criteria'
    ];
    
    const pythonScript = {
      description: hasData ? 'Data analysis and visualization script' : 'Data validation script',
      code: hasData ? `
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import json

print("🔍 Loading and analyzing data...")

# Load the query results
with open('${queryResult?.filepath || 'query_results.json'}', 'r', encoding='utf-8') as f:
    result = json.load(f)

# Convert to DataFrame
df = pd.DataFrame(result['data'])
print(f"✅ Loaded {len(df)} rows with {len(df.columns)} columns")
print(f"📊 Columns: {list(df.columns)}")

# Basic statistics
print("\\n📈 Basic Statistics:")
print(df.describe())

# Data types info
print("\\n🔢 Data Types:")
print(df.dtypes)

# Create visualizations if numeric data exists
numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
if numeric_cols:
    plt.figure(figsize=(12, 8))
    
    # Distribution plot for first numeric column
    if len(numeric_cols) > 0:
        plt.subplot(2, 2, 1)
        df[numeric_cols[0]].hist(bins=20, alpha=0.7)
        plt.title(f'Distribution of {numeric_cols[0]}')
        plt.xlabel(numeric_cols[0])
        plt.ylabel('Frequency')
    
    # Top values if categorical columns exist
    categorical_cols = df.select_dtypes(include=['object']).columns.tolist()
    if categorical_cols and len(categorical_cols) > 0:
        plt.subplot(2, 2, 2)
        top_values = df[categorical_cols[0]].value_counts().head(10)
        top_values.plot(kind='bar')
        plt.title(f'Top 10 {categorical_cols[0]}')
        plt.xticks(rotation=45)
    
    plt.tight_layout()
    plt.savefig('analysis_charts.png', dpi=300, bbox_inches='tight')
    print("\\n📊 Saved analysis charts as 'analysis_charts.png'")

# Save summary
with open('analysis_summary.txt', 'w') as f:
    f.write(f"Analysis Summary for: ${userQuery}\\n")
    f.write(f"="*50 + "\\n\\n")
    f.write(f"Total Records: {len(df)}\\n")
    f.write(f"Columns: {len(df.columns)}\\n")
    f.write(f"Numeric Columns: {len(numeric_cols)}\\n")
    f.write(f"Date Range: {result.get('timestamp', 'Unknown')}\\n\\n")
    
    if numeric_cols:
        f.write("Key Metrics:\\n")
        for col in numeric_cols[:3]:  # Top 3 numeric columns
            f.write(f"- {col}: {df[col].sum():,.2f} (total)\\n")

print("\\n✅ Analysis complete! Check 'analysis_summary.txt' for details.")
`.trim() : `
import pandas as pd
import json

print("⚠️  No data found for analysis")
print(f"Query: ${userQuery}")
print("Recommendation: Try adjusting your search criteria")

# Create empty result files
with open('analysis_summary.txt', 'w') as f:
    f.write(f"Analysis Summary\\n")
    f.write(f"="*30 + "\\n\\n")
    f.write(f"Query: ${userQuery}\\n")
    f.write(f"Result: No data found\\n")
    f.write(f"Suggestion: Broaden search criteria or check data availability\\n")

print("✅ Created analysis summary")
`.trim(),
      outputFiles: hasData ? ['analysis_charts.png', 'analysis_summary.txt'] : ['analysis_summary.txt']
    };
    
    return {
      insights,
      pythonScript,
      recommendations,
      followUpQuestions: hasData ? [
        'What specific patterns do you see in the top results?',
        'Would you like to analyze a different time period?',
        'Should we drill down into specific categories?',
        'Are there other metrics you want to explore?'
      ] : [
        'Would you like to try a broader date range?',
        'Should we check different data sources?',
        'Are there alternative criteria we should consider?'
      ],
      error: errorMessage
    };
  }

  async executePythonScript(scriptContent, dataFilepath, sessionId) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const scriptFilename = `analysis_${sessionId}_${timestamp}.py`;
    const scriptPath = path.join(this.dataDir, 'scripts', scriptFilename);
    const outputDir = path.join(this.dataDir, 'analysis', `session_${sessionId}_${timestamp}`);

    try {
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Prepare Python script with proper file paths
      const fullScript = `
import json
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import os
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Set up paths
data_file = "${dataFilepath}"
output_dir = "${outputDir}"
os.makedirs(output_dir, exist_ok=True)

# Load data
with open(data_file, 'r') as f:
    file_data = json.load(f)
    
data = file_data['data']
df = pd.DataFrame(data)

print(f"Loaded {len(df)} rows with columns: {list(df.columns)}")

# User's analysis script
${scriptContent}

print("Analysis completed successfully!")
`;

      // Validate the full script before execution
      const validation = await this.validator.validatePythonScript(fullScript);
      if (!validation.valid) {
        console.error('❌ Script validation failed:', validation.errors);
        if (validation.warnings.length > 0) {
          console.warn('⚠️  Script warnings:', validation.warnings);
        }
        
        // Try to auto-fix common issues
        console.log('🔧 Attempting automatic fixes...');
        let fixedScript = fullScript;
        
        // Fix file paths
        fixedScript = fixedScript.replace(/\.savefig\(['"]([^'"]+)['"]\)/g, 
                                      ".savefig(os.path.join(output_dir, '$1'))");
        
        // Fix data parameter in seaborn
        fixedScript = fixedScript.replace(/sns\.(barplot|scatterplot|lineplot|boxplot)\(x=/g, 
                                      'sns.$1(data=df, x=');
        
        // Re-validate after fixes
        const revalidation = await this.validator.validatePythonScript(fixedScript);
        if (revalidation.valid) {
          console.log('✅ Python script fixed automatically');
          fullScript = fixedScript;
        } else {
          console.log('⚠️  Some Python script issues remain');
        }
      }

      // Save script
      await fs.writeFile(scriptPath, fullScript);

      // Execute Python script with better logging
      console.log('🐍 Executing Python analysis script...');
      console.log('📁 Script path:', scriptPath);
      console.log('📂 Output directory:', outputDir);
      
      const result = await this.runPythonScriptWithLogging(scriptPath);
      
      // Read generated files
      const outputFiles = await this.getOutputFiles(outputDir);
      
      return {
        success: result.success,
        output: result.output,
        error: result.error,
        scriptPath,
        outputDir,
        outputFiles
      };
    } catch (error) {
      console.error('Python script execution failed:', error);
      return {
        success: false,
        error: error.message,
        output: '',
        outputFiles: []
      };
    }
  }

  async runPythonScript(scriptPath) {
    return this.runPythonScriptWithLogging(scriptPath);
  }

  async runPythonScriptWithLogging(scriptPath) {
    return new Promise((resolve) => {
      console.log('📝 Starting Python script execution...');
      const python = spawn('python3', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000 // 1 minute timeout
      });

      let output = '';
      let error = '';

      python.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        // Log Python output in real-time
        const lines = chunk.split('\n').filter(line => line.trim());
        lines.forEach(line => console.log('🐍 Python:', line));
      });

      python.stderr.on('data', (data) => {
        const chunk = data.toString();
        error += chunk;
        // Log Python errors in real-time
        const lines = chunk.split('\n').filter(line => line.trim());
        lines.forEach(line => console.error('❌ Python Error:', line));
      });

      python.on('close', (code) => {
        console.log(`Python script exited with code ${code}`);
        const success = code === 0;
        
        // Log Python execution
        this.logger.logPythonExecution(scriptPath, success, output, error);
        
        resolve({
          success,
          output,
          error: error || null
        });
      });

      python.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        resolve({
          success: false,
          output,
          error: err.message
        });
      });
    });
  }

  async getOutputFiles(outputDir) {
    try {
      const files = await fs.readdir(outputDir);
      const outputFiles = [];

      for (const file of files) {
        const filepath = path.join(outputDir, file);
        const stats = await fs.stat(filepath);
        
        outputFiles.push({
          filename: file,
          filepath,
          size: stats.size,
          type: path.extname(file)
        });
      }

      return outputFiles;
    } catch (error) {
      console.warn('Could not read output files:', error);
      return [];
    }
  }

  async processUserQuery(userQuery, sessionId) {
    await this.initialize();
    
    // Initialize logging for this session
    await this.logger.initializeSession(sessionId, userQuery);

    const workflow = {
      step: 1,
      userQuery,
      sessionId,
      timestamp: new Date().toISOString()
    };

    try {
      await this.logger.log('WORKFLOW_START', 'Starting query processing workflow');
      // Step 1: Validate query
      console.log('📝 Step 1: Validating query...');
      console.log(`   Query: "${userQuery}"`);
      const validation = await this.validateQuery(userQuery);
      workflow.validation = validation;
      console.log(`   ✓ Validation result: ${validation.isValid ? 'Valid' : 'Invalid'}`);
      if (validation.requiredTables?.length > 0) {
        console.log(`   📊 Required tables: ${validation.requiredTables.join(', ')}`);
      }

      if (!validation.isValid) {
        return {
          success: false,
          step: 1,
          error: validation.reason,
          suggestion: validation.suggestedApproach
        };
      }

      // Step 2: Generate optimized query
      console.log('⚙️ Step 2: Generating optimized query...');
      const queryObj = await this.generateOptimizedQuery(userQuery, validation);
      workflow.queryObj = queryObj;
      console.log(`   🔧 Generated SQL: ${queryObj.query || 'No query generated'}`);
      if (queryObj.limitations) {
        console.log(`   ⚠️  Limitations applied: ${queryObj.limitations}`);
      }

      if (!queryObj.query) {
        return {
          success: false,
          step: 2,
          error: 'Failed to generate SQL query',
          details: queryObj
        };
      }

      // Step 3: Execute query and save data
      console.log('🔍 Step 3: Executing query and saving data...');
      const queryResult = await this.executeQueryAndSave(queryObj, sessionId);
      workflow.queryResult = queryResult;
      console.log(`   📁 Data saved to: ${queryResult.filepath || 'No file saved'}`);
      console.log(`   📊 Query returned: ${queryResult.rowCount || 0} rows`);

      if (!queryResult.success) {
        return {
          success: false,
          step: 3,
          error: queryResult.error
        };
      }

      // Step 4: Generate analysis strategy
      console.log('🧠 Step 4: Generating analysis strategy...');
      const strategy = await this.generateAnalysisStrategy(queryResult, userQuery);
      workflow.strategy = strategy;

      // Step 5: Execute Python analysis (if script was generated)
      let analysisResult = null;
      if (strategy.pythonScript && strategy.pythonScript.code) {
        console.log('🐍 Step 5: Executing Python analysis...');
        analysisResult = await this.executePythonScript(
          strategy.pythonScript.code,
          queryResult.filepath,
          sessionId
        );
        workflow.analysisResult = analysisResult;
      }

      // Step 6: Compile final response
      console.log('📊 Step 6: Compiling final response...');
      const finalResponse = {
        success: true,
        workflow,
        summary: {
          dataProcessed: `${queryResult.rowCount} rows (${Math.round(queryResult.dataSize/1024)}KB)`,
          query: queryObj.query,
          insights: strategy.insights,
          recommendations: strategy.recommendations,
          followUpQuestions: strategy.followUpQuestions
        }
      };

      if (analysisResult && analysisResult.success) {
        finalResponse.summary.analysisOutput = analysisResult.output;
        finalResponse.summary.generatedFiles = analysisResult.outputFiles;
      }

      await this.logger.finalizeSession(true, finalResponse);
      return finalResponse;

    } catch (error) {
      console.error('Workflow failed:', error);
      await this.logger.logError(error, { workflow, step: workflow.step });
      await this.logger.finalizeSession(false, { error: error.message });
      
      return {
        success: false,
        error: error.message,
        workflow
      };
    }
  }
}