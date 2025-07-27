import { PYTHON_PACKAGES } from '../config/constants';

export class AnalysisStrategyPrompts {
  private static readonly PYTHON_REQUIREMENTS = `
AVAILABLE DEPENDENCIES (pre-installed):
${PYTHON_PACKAGES.map(pkg => `- ${pkg}`).join('\n')}
- os (for file operations)

CRITICAL DECISION MAKING:
1. First, analyze if this query result can benefit from Python analysis:
   - Does it have meaningful numerical data to analyze?
   - Are there trends, patterns, or visualizations that would add value?
   - Would statistical analysis provide insights beyond the raw data?
   - If NO to all above, set "skipAnalysis": true with explanation

2. If analysis IS appropriate, create a UNIQUE script that:
   - Is specifically tailored to THIS query's data structure and user intent
   - Uses only the available dependencies listed above
   - If you need other packages, list them in "missingDependencies" array
   - Handles the ACTUAL column names and data types from the sample
   - Creates meaningful outputs (charts, statistics, summaries) based on the data

3. Script Requirements:
   - 'df' variable contains the query results as a pandas DataFrame
   - Use 'output_dir' for saving files: os.path.join(output_dir, 'filename.ext')
   - Handle NULL/missing values appropriately
   - Include proper error handling for data type conversions
   - Generate files with descriptive names related to the analysis

4. Be CREATIVE and SPECIFIC:
   - For sales data: trend analysis, seasonality, top performers
   - For product data: category analysis, price distributions, inventory insights
   - For customer data: segmentation, behavior patterns, lifetime value
   - For time-series: forecasting, anomaly detection, period comparisons
   - Match the analysis to the user's actual question intent`;

  static create(userQuery: string, sampleData: any[], rowCount: number): string {
    return `You are a data analysis expert. Create a custom analysis strategy tailored to the user's specific requirements.

User Query: "${userQuery}"
Data Sample (${sampleData.length} rows from ${rowCount} total):
${JSON.stringify(sampleData, null, 2)}

Based on the user's specific request and the data structure, create a comprehensive and customized analysis.

Generate a JSON response with:
{
  "analysisDecision": {
    "shouldAnalyze": true/false,
    "reasoning": "Explain why Python analysis would or wouldn't add value for this specific query"
  },
  "insights": {
    "immediate": ["Key insights visible in the data"],
    "statistical": ["Statistical patterns and metrics relevant to the query"],
    "business": ["Business implications and actionable insights"]
  },
  "pythonScript": {
    "description": "What THIS SPECIFIC script will do with THIS data",
    "code": "# ACTUAL WORKING PYTHON CODE HERE - not placeholder text\n# Must be complete, executable code specific to this query\n# Use actual column names from the data sample",
    "outputFiles": ["specific filenames like 'sales_decline_analysis.png', 'product_performance_summary.csv']",
    "skipAnalysis": false,
    "missingDependencies": []
  },
  "recommendations": ["Specific actionable recommendations based on the data"],
  "followUpQuestions": ["Relevant follow-up questions based on the analysis"]
}

${this.PYTHON_REQUIREMENTS}`;
  }

  static createFallback(_userQuery: string, rowCount: number, queryType: string): any {
    const hasData = rowCount > 0;
    const isTopQuery = queryType.includes('top');
    const isSalesQuery = queryType.includes('sales');
    
    return {
      insights: {
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
          isSalesQuery ? 'Sales performance data ready for revenue analysis' :
          'Business metrics extracted and ready for strategic decisions'
        ] : [
          'No business insights available due to empty dataset',
          'Recommend adjusting query parameters to capture relevant data'
        ]
      }
    };
  }
}