// @ts-nocheck
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import fs from 'fs/promises';
import path from 'path';
import { ScriptValidator } from '../script-validator';
import { Logger } from '../logger';
import { DataSampler, FileManager, PythonExecutor, JSONParser } from '../utils';
import { AnalysisStrategyPrompts } from '../prompts';
import { AI_MODELS, TOKEN_LIMITS } from '../config/constants';

export class AnalysisService {
  private validator: ScriptValidator;
  private logger: Logger;
  private dataDir: string;
  private aiResponsesDir: string;

  constructor(logger: Logger, dataDir: string) {
    this.validator = new ScriptValidator();
    this.logger = logger;
    this.dataDir = dataDir;
    this.aiResponsesDir = path.join(dataDir, 'ai-responses');
  }

  async generateAnalysisStrategy(queryResult: any, userQuery: string): Promise<any> {
    const { sampleData, sampleSize, totalRows } = DataSampler.prepareForAnalysis(
      queryResult.data || [], 
      queryResult.rowCount
    );
    
    // Handle empty data gracefully
    if (sampleData.length === 0) {
      console.log('⚠️  No data returned from query, providing basic analysis');
      return this.getEmptyDataStrategy(userQuery);
    }

    console.log(`📊 Using representative sample: ${sampleSize} rows from ${totalRows} total`);

    const analysisPrompt = AnalysisStrategyPrompts.create(userQuery, sampleData, totalRows);

    let attempt = 0;
    const maxAttempts = 2;
    
    while (attempt < maxAttempts) {
      try {
        console.log(`📝 Generating analysis strategy (attempt ${attempt + 1}/${maxAttempts})...`);
        
        const result = await generateText({
          model: openai(AI_MODELS.ANALYSIS_STRATEGY),
          prompt: analysisPrompt,
          maxTokens: TOKEN_LIMITS.ANALYSIS_STRATEGY
        });

        // Save raw AI response
        await this.saveAIResponse('analysis-strategy', result, analysisPrompt);

        await this.logger.logModelCall(AI_MODELS.ANALYSIS_STRATEGY, analysisPrompt, result.text);
        const strategy = JSONParser.parseAIResponse(result.text);
        
        // Check if analysis should be skipped
        if (strategy.analysisDecision?.shouldAnalyze === false || strategy.pythonScript?.skipAnalysis === true) {
          console.log('📊 Analysis skipped:', strategy.analysisDecision?.reasoning || 'Not applicable for this query');
          return strategy;
        }
        
        // Check for missing dependencies
        if (strategy.pythonScript?.missingDependencies?.length > 0) {
          console.log('⚠️  Missing Python dependencies detected:');
          console.log('   Please install:', strategy.pythonScript.missingDependencies.join(', '));
          console.log('   Skipping Python analysis for this query.');
          strategy.pythonScript.skipAnalysis = true;
          return strategy;
        }
        
        // Validate the generated Python script
        if (strategy.pythonScript?.code && strategy.pythonScript?.code !== "# ACTUAL WORKING PYTHON CODE HERE - not placeholder text\n# Must be complete, executable code specific to this query\n# Use actual column names from the data sample") {
          const validation = await this.validator.validatePythonScript(strategy.pythonScript.code);
          
          if (validation.valid) {
            console.log('✅ Generated Python script passed validation');
            return strategy;
          } else {
            console.log(`⚠️  Python script validation failed: ${validation.errors.join(', ')}`);
            
            if (attempt < maxAttempts - 1) {
              console.log('🔄 Regenerating script with validation feedback...');
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

  async executePythonScript(
    scriptContent: string, 
    dataFilepath: string, 
    sessionId: string
  ): Promise<any> {
    try {
      const { scriptPath, outputDir } = await FileManager.savePythonScript(
        scriptContent, 
        sessionId, 
        this.dataDir
      );

      // Prepare Python script with proper file paths
      const fullScript = this.preparePythonScript(scriptContent, dataFilepath, outputDir);
      
      // Write the full script to the file
      await fs.writeFile(scriptPath, fullScript);
      
      // Validate the full script before execution
      const validation = await this.validator.validatePythonScript(fullScript);
      if (!validation.valid) {
        console.error('❌ Script validation failed:', validation.errors);
        if (validation.warnings.length > 0) {
          console.warn('⚠️  Script warnings:', validation.warnings);
        }
        
        // Try to auto-fix common issues
        console.log('🔧 Attempting automatic fixes...');
        const fixedScript = this.autoFixPythonScript(fullScript);
        
        const revalidation = await this.validator.validatePythonScript(fixedScript);
        if (revalidation.valid) {
          console.log('✅ Python script fixed automatically');
        } else {
          console.log('⚠️  Some Python script issues remain');
        }
      }

      console.log('🐍 Executing Python analysis script...');
      console.log('📁 Script path:', scriptPath);
      console.log('📂 Output directory:', outputDir);
      
      const result = await PythonExecutor.execute(scriptPath, this.logger);
      const outputFiles = await FileManager.getOutputFiles(outputDir);
      
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

  private preparePythonScript(scriptContent: string, dataFilepath: string, outputDir: string): string {
    // Fix common path issues in the script content
    let fixedScript = scriptContent;
    
    // Remove any hardcoded output_dir assignments that would override our setting
    fixedScript = fixedScript.replace(/output_dir\s*=\s*['"]\.['"]/g, "# output_dir already defined above");
    fixedScript = fixedScript.replace(/output_dir\s*=\s*['"]\.\//g, "# output_dir already defined above");
    
    // Replace relative output paths with absolute paths using output_dir variable
    fixedScript = fixedScript.replace(/['"]output\/([^'"]+)['"]/g, "os.path.join(output_dir, '$1')");
    fixedScript = fixedScript.replace(/\.to_csv\(['"]([^'"]+)['"]/g, ".to_csv(os.path.join(output_dir, '$1')");
    fixedScript = fixedScript.replace(/\.savefig\(['"]([^'"]+)['"]/g, ".savefig(os.path.join(output_dir, '$1')");
    
    return `
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

# User's analysis script (with fixed paths)
${fixedScript}

print("Analysis completed successfully!")
`;
  }

  private autoFixPythonScript(script: string): string {
    let fixedScript = script;
    
    // Remove any hardcoded output_dir assignments
    fixedScript = fixedScript.replace(/output_dir\s*=\s*['"]\.['"]/g, "# output_dir already defined");
    fixedScript = fixedScript.replace(/output_dir\s*=\s*['"]\.\//g, "# output_dir already defined");
    
    // Fix file paths
    fixedScript = fixedScript.replace(/\.savefig\(['"]([^'"]+)['"]\)/g, 
                                ".savefig(os.path.join(output_dir, '$1'))");
    fixedScript = fixedScript.replace(/\.to_csv\(['"]([^'"]+)['"]\)/g, 
                                ".to_csv(os.path.join(output_dir, '$1'))");
    
    // Fix data parameter in seaborn
    fixedScript = fixedScript.replace(/sns\.(barplot|scatterplot|lineplot|boxplot)\(x=/g, 
                                'sns.$1(data=df, x=');
    
    return fixedScript;
  }

  private getEmptyDataStrategy(userQuery: string): any {
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

  private getFallbackAnalysisStrategy(userQuery: string, queryResult: any, errorMessage: string): any {
    console.log('🔄 Using fallback analysis strategy');
    
    const rowCount = queryResult?.rowCount || 0;
    const queryType = userQuery.toLowerCase();
    
    return AnalysisStrategyPrompts.createFallback(userQuery, rowCount, queryType);
  }

  private async saveAIResponse(type: string, result: any, prompt: string): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(this.aiResponsesDir, { recursive: true });
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${type}_${timestamp}.json`;
      const filepath = path.join(this.aiResponsesDir, filename);
      
      // Save the response data
      const responseData = {
        timestamp: new Date().toISOString(),
        type,
        prompt,
        rawResponse: result.text,
        usage: result.usage,
        model: result.modelId,
        finishReason: result.finishReason,
        metadata: {
          promptTokens: result.usage?.promptTokens,
          completionTokens: result.usage?.completionTokens,
          totalTokens: result.usage?.totalTokens
        }
      };
      
      await fs.writeFile(filepath, JSON.stringify(responseData, null, 2));
      console.log(`💾 Raw AI response saved to: ${filepath}`);
    } catch (error) {
      console.error('Failed to save AI response:', error);
    }
  }
}