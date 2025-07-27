// @ts-nocheck
import path from 'path';
import { ScriptValidator } from './script-validator';
import { Logger } from './logger';
import { SchemaService, QueryService, AnalysisService } from './services';
import { FileManager } from './utils';
import { Environment, PYTHON_PACKAGES } from './config';

export class AnalyticsAgent {
  private schemaService: SchemaService;
  private queryService: QueryService;
  private analysisService: AnalysisService;
  private validator: ScriptValidator;
  private logger: Logger;
  private dataDir: string;
  private initialized = false;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.logger = new Logger();
    this.schemaService = new SchemaService(this.logger);
    this.queryService = new QueryService(this.logger, this.dataDir);
    this.analysisService = new AnalysisService(this.logger, this.dataDir);
    this.validator = new ScriptValidator();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('🚀 Initializing Analytics Agent...');
    
    // Validate environment
    const envValidation = Environment.validate();
    if (!envValidation.valid) {
      throw new Error(`Missing required environment variables: ${envValidation.missing.join(', ')}`);
    }
    
    // Create data directory structure
    await this.ensureDataDirectory();
    
    // Check Python dependencies
    await this.checkAndInstallPythonDependencies();
    
    // Fetch and cache all database schemas
    await this.schemaService.cacheSchemas(Environment.databases);
    
    this.initialized = true;
    console.log('✅ Analytics Agent initialized successfully');
  }

  private async ensureDataDirectory(): Promise<void> {
    await FileManager.ensureDirectoryExists(path.join(this.dataDir, 'queries'));
    await FileManager.ensureDirectoryExists(path.join(this.dataDir, 'analysis'));
    await FileManager.ensureDirectoryExists(path.join(this.dataDir, 'scripts'));
  }

  private async checkAndInstallPythonDependencies(): Promise<void> {
    const depCheck = await this.validator.checkDependencies();
    if (depCheck.missing.length > 0) {
      console.log('📦 Installing missing Python packages:', depCheck.missing.join(', '));
      const installResult = await this.validator.installMissingDependencies(depCheck.missing);
      if (!installResult.success) {
        console.error('❌ Failed to install dependencies:', installResult.error);
        console.log('💡 Please install manually: pip3 install', depCheck.missing.join(' '));
      }
    }
  }

  getSchemaCount(): number {
    return this.schemaService.getSchemas().size;
  }

  getSchemasMap(): Map<string, any> {
    return this.schemaService.getSchemas();
  }

  async processUserQuery(userQuery: string, sessionId: string): Promise<any> {
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
      
      const validation = await this.queryService.validateQuery(userQuery, this.schemaService.getSchemas());
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
      
      const relevantSchemas = this.schemaService.getRelevantSchemas(validation.requiredTables);
      this.schemaService.debugSchemaInfo(relevantSchemas);
      
      const queryObj = await this.queryService.generateOptimizedQuery(userQuery, relevantSchemas);
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
      
      const queryResult = await this.queryService.executeQueryAndSave(
        queryObj, 
        sessionId, 
        this.schemaService.getSchemas()
      );
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
      const strategy = await this.analysisService.generateAnalysisStrategy(queryResult, userQuery);
      workflow.strategy = strategy;

      // Step 5: Execute Python analysis (if script was generated and not skipped)
      let analysisResult = null;
      if (strategy.pythonScript && strategy.pythonScript.code && !strategy.pythonScript.skipAnalysis) {
        console.log('🐍 Step 5: Executing Python analysis...');
        analysisResult = await this.analysisService.executePythonScript(
          strategy.pythonScript.code,
          queryResult.filepath,
          sessionId
        );
        workflow.analysisResult = analysisResult;
      } else if (strategy.pythonScript?.skipAnalysis) {
        console.log('⏭️  Step 5: Python analysis skipped');
        workflow.analysisResult = {
          success: false,
          skipped: true,
          reason: strategy.analysisDecision?.reasoning || 'Analysis not applicable for this query'
        };
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