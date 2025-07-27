#!/usr/bin/env node
// @ts-nocheck

import dotenv from 'dotenv';
import readline from 'readline';
import { AnalyticsAgent } from './lib/analytics-agent-refactored';

dotenv.config();

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step: string, message: string) {
  log(colors.blue, `🔍 [${step}] ${message}`);
}

function logSuccess(message: string) {
  log(colors.green, `✅ ${message}`);
}

function logError(message: string) {
  log(colors.red, `❌ ${message}`);
}

function logWarning(message: string) {
  log(colors.yellow, `⚠️  ${message}`);
}

function logInfo(message: string) {
  log(colors.cyan, `ℹ️  ${message}`);
}

class AnalyticsCLI {
  private agent: AnalyticsAgent;
  private rl: readline.Interface;
  private initialized = false;

  constructor() {
    this.agent = new AnalyticsAgent();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: colors.magenta + '📊 Analytics> ' + colors.reset
    });
  }

  async initialize() {
    console.log(colors.bold + colors.cyan + '\n🚀 E-commerce Analytics Agent CLI\n' + colors.reset);
    
    logStep('INIT', 'Starting analytics agent initialization...');
    
    try {
      await this.agent.initialize();
      this.initialized = true;
      logSuccess('Analytics agent initialized successfully');
      logInfo(`Cached ${this.agent.getSchemaCount()} table schemas from databases`);
      
      // Show available tables
      console.log(colors.dim + '\n📋 Available Tables:' + colors.reset);
      for (const [key, schema] of this.agent.getSchemasMap().entries()) {
        console.log(`   ${colors.cyan}${key}${colors.reset} (${schema.columns?.length || 0} columns)`);
      }
      
    } catch (error) {
      logError(`Failed to initialize analytics agent: ${error.message}`);
      process.exit(1);
    }
  }

  async start() {
    await this.initialize();
    
    console.log(colors.yellow + '\n💡 Type your analytics query, or use these commands:' + colors.reset);
    console.log('   • help    - Show available commands');
    console.log('   • tables  - List all available tables');
    console.log('   • schema <table> - Show table schema');
    console.log('   • exit    - Exit the CLI\n');
    
    this.rl.prompt();
    
    this.rl.on('line', async (input) => {
      const query = input.trim();
      
      if (!query) {
        this.rl.prompt();
        return;
      }
      
      await this.handleCommand(query);
      this.rl.prompt();
    });
    
    this.rl.on('close', () => {
      console.log(colors.cyan + '\n👋 Thanks for using Analytics Agent CLI!' + colors.reset);
      process.exit(0);
    });
  }

  async handleCommand(input: string) {
    const [command, ...args] = input.split(' ');
    
    switch (command.toLowerCase()) {
      case 'help':
        this.showHelp();
        break;
        
      case 'tables':
        this.showTables();
        break;
        
      case 'schema':
        if (args.length === 0) {
          logWarning('Please specify a table name. Usage: schema <table_name>');
        } else {
          this.showSchema(args[0]);
        }
        break;
        
      case 'exit':
      case 'quit':
        this.rl.close();
        break;
        
      default:
        // Treat as analytics query
        await this.processQuery(input);
        break;
    }
  }

  showHelp() {
    console.log(colors.cyan + '\n📖 Available Commands:' + colors.reset);
    console.log('   • help                 - Show this help message');
    console.log('   • tables               - List all available tables');
    console.log('   • schema <table>       - Show detailed schema for a table');
    console.log('   • exit/quit            - Exit the CLI');
    console.log('\n📊 Analytics Queries:');
    console.log('   Just type your question in natural language!');
    console.log('   Examples:');
    console.log('     - "Show me the top 10 products by sales"');
    console.log('     - "What are the sales trends by month?"');
    console.log('     - "Which customers have the highest orders?"');
    console.log('     - "Show page views by product type"\n');
  }

  showTables() {
    console.log(colors.cyan + '\n📋 Available Tables:\n' + colors.reset);
    
    // Group by database
    const tablesByDb = new Map();
    for (const [key, schema] of this.agent.getSchemasMap().entries()) {
      const [database, table] = key.split('.');
      if (!tablesByDb.has(database)) {
        tablesByDb.set(database, []);
      }
      tablesByDb.get(database).push({ table, schema });
    }
    
    for (const [database, tables] of tablesByDb.entries()) {
      console.log(colors.bold + colors.magenta + `🗄️  Database: ${database}` + colors.reset);
      for (const { table, schema } of tables) {
        console.log(`   ${colors.cyan}${table}${colors.reset} - ${schema.columns?.length || 0} columns`);
        if (schema.stats && schema.stats.row_count !== 'Unknown') {
          console.log(`     ${colors.dim}Rows: ${schema.stats.row_count}${colors.reset}`);
        }
      }
      console.log('');
    }
  }

  showSchema(tableName: string) {
    // Find table (could be just table name or database.table)
    let fullTableName = tableName;
    if (!tableName.includes('.')) {
      // Search for table in all databases
      for (const key of this.agent.getSchemasMap().keys()) {
        if (key.endsWith(`.${tableName}`)) {
          fullTableName = key;
          break;
        }
      }
    }
    
    const schema = this.agent.getSchemasMap().get(fullTableName);
    if (!schema) {
      logError(`Table '${tableName}' not found. Use 'tables' command to see available tables.`);
      return;
    }
    
    console.log(colors.cyan + `\n📊 Schema for ${fullTableName}:\n` + colors.reset);
    
    if (schema.columns && schema.columns.length > 0) {
      console.log(colors.bold + 'Columns:' + colors.reset);
      schema.columns.forEach((col: any, index: number) => {
        const isPrimaryKey = col.is_in_primary_key ? colors.yellow + ' [PK]' + colors.reset : '';
        const isSortingKey = col.is_in_sorting_key ? colors.blue + ' [SK]' + colors.reset : '';
        console.log(`  ${index + 1}. ${colors.green}${col.name}${colors.reset} : ${colors.cyan}${col.type}${colors.reset}${isPrimaryKey}${isSortingKey}`);
        if (col.comment) {
          console.log(`     ${colors.dim}${col.comment}${colors.reset}`);
        }
      });
    }
    
    if (schema.stats) {
      console.log(colors.bold + '\nTable Statistics:' + colors.reset);
      console.log(`  Rows: ${schema.stats.row_count || 'Unknown'}`);
      console.log(`  Size: ${schema.stats.size || 'Unknown'}`);
    }
    console.log('');
  }

  async processQuery(userQuery: string) {
    if (!this.initialized) {
      logError('Agent not initialized. Please restart the CLI.');
      return;
    }
    
    console.log(colors.yellow + `\n🔍 Processing query: "${userQuery}"\n` + colors.reset);
    
    try {
      logStep('VALIDATION', 'Validating query against database schemas...');
      
      // Generate session ID
      const sessionId = `cli_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      logStep('PROCESSING', `Starting analysis with session ID: ${sessionId}`);
      
      // Process the query using the analytics agent
      const result = await this.agent.processUserQuery(userQuery, sessionId);
      
      if (result.success) {
        logSuccess('Query processed successfully!');
        
        // Display results
        console.log(colors.cyan + '\n📊 Analysis Results:\n' + colors.reset);
        
        // Show SQL Query
        if (result.summary?.query || result.workflow?.queryObj?.query) {
          console.log(colors.bold + '🔧 Generated SQL Query:' + colors.reset);
          const sqlQuery = result.summary?.query || result.workflow?.queryObj?.query;
          console.log(colors.dim + sqlQuery + colors.reset + '\n');
        }
        
        // Show data processing summary
        if (result.summary?.dataProcessed) {
          console.log(colors.bold + '📊 Data Summary:' + colors.reset);
          console.log(result.summary.dataProcessed + '\n');
        }
        
        // Show sample data if available
        if (result.workflow?.queryResult?.data && result.workflow.queryResult.data.length > 0) {
          console.log(colors.bold + '📋 Sample Results (first 5 rows):' + colors.reset);
          const sampleData = result.workflow.queryResult.data.slice(0, 5);
          console.table(sampleData);
          console.log('');
        }
        
        // Show insights
        if (result.summary?.insights) {
          const insights = result.summary.insights;
          
          if (insights.immediate && insights.immediate.length > 0) {
            console.log(colors.bold + '💡 Key Insights:' + colors.reset);
            insights.immediate.forEach((insight: string, index: number) => {
              console.log(`${index + 1}. ${insight}`);
            });
            console.log('');
          }
          
          if (insights.business && insights.business.length > 0) {
            console.log(colors.bold + '🏢 Business Insights:' + colors.reset);
            insights.business.forEach((insight: string, index: number) => {
              console.log(`${index + 1}. ${insight}`);
            });
            console.log('');
          }
          
          if (insights.statistical && insights.statistical.length > 0) {
            console.log(colors.bold + '📈 Statistical Insights:' + colors.reset);
            insights.statistical.forEach((insight: string, index: number) => {
              console.log(`${index + 1}. ${insight}`);
            });
            console.log('');
          }
        }
        
        // Show recommendations
        if (result.summary?.recommendations && result.summary.recommendations.length > 0) {
          console.log(colors.bold + '🎯 Recommendations:' + colors.reset);
          result.summary.recommendations.forEach((rec: string, index: number) => {
            console.log(`${index + 1}. ${rec}`);
          });
          console.log('');
        }
        
        // Show follow-up questions
        if (result.summary?.followUpQuestions && result.summary.followUpQuestions.length > 0) {
          console.log(colors.bold + '❓ Follow-up Questions:' + colors.reset);
          result.summary.followUpQuestions.forEach((question: string, index: number) => {
            console.log(`${index + 1}. ${question}`);
          });
          console.log('');
        }
        
        // Show analysis output if available
        if (result.summary?.analysisOutput) {
          console.log(colors.bold + '🔬 Analysis Output:' + colors.reset);
          console.log(result.summary.analysisOutput + '\n');
        }
        
        // Show file locations
        if (result.workflow?.queryResult?.dataFile) {
          logInfo(`Query results saved to: ${result.workflow.queryResult.dataFile}`);
        }
        
        if (result.summary?.generatedFiles && result.summary.generatedFiles.length > 0) {
          logInfo(`Generated files: ${result.summary.generatedFiles.join(', ')}`);
        }
        
      } else {
        logError('Query processing failed');
        if (result.error) {
          console.log(colors.red + `Error: ${result.error}` + colors.reset);
        }
      }
      
    } catch (error) {
      logError(`Failed to process query: ${error.message}`);
      console.log(colors.dim + error.stack + colors.reset);
    }
  }
}

// Start the CLI
async function main() {
  const cli = new AnalyticsCLI();
  await cli.start();
}

// Auto-start CLI if run directly
main().catch((error) => {
  console.error(colors.red + `CLI startup failed: ${error.message}` + colors.reset);
  process.exit(1);
});

export { AnalyticsCLI };