import dotenv from 'dotenv';
import { AnalyticsAgent } from '@/lib/analytics-agent';

dotenv.config();

export const runtime = 'nodejs';

// Initialize the analytics agent (singleton pattern)
let analyticsAgent = null;
const getAgent = () => {
  if (!analyticsAgent) {
    analyticsAgent = new AnalyticsAgent();
  }
  return analyticsAgent;
};

export async function POST(req) {
  try {
    const { messages } = await req.json();
    
    // Get the latest user message
    const userMessage = messages[messages.length - 1];
    if (!userMessage || userMessage.role !== 'user') {
      return new Response(
        JSON.stringify({ error: 'No user message found' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userQuery = userMessage.content;
    
    // Generate session ID based on timestamp and user query hash
    const sessionId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    console.log(`🔍 Processing query: "${userQuery}" (Session: ${sessionId})`);
    
    // Get analytics agent and process the query
    const agent = getAgent();
    const result = await agent.processUserQuery(userQuery, sessionId);
    
    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: result.error,
          step: result.step,
          suggestion: result.suggestion,
          details: result.details
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Format successful response for the user
    const responseMessage = formatAnalyticsResponse(result);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: responseMessage,
        sessionId,
        metadata: {
          dataProcessed: result.summary.dataProcessed,
          sqlQuery: result.summary.query,
          generatedFiles: result.summary.generatedFiles || [],
          workflow: result.workflow
        }
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Analytics API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function formatAnalyticsResponse(result) {
  const { summary } = result;
  
  let response = `## 📊 Analysis Results\n\n`;
  
  // Data summary
  response += `**Data Processed:** ${summary.dataProcessed}\n\n`;
  
  // SQL Query used
  response += `**SQL Query:**\n\`\`\`sql\n${summary.query}\n\`\`\`\n\n`;
  
  // Immediate insights
  if (summary.insights.immediate.length > 0) {
    response += `### 🔍 Key Insights\n`;
    summary.insights.immediate.forEach(insight => {
      response += `• ${insight}\n`;
    });
    response += `\n`;
  }
  
  // Statistical insights
  if (summary.insights.statistical.length > 0) {
    response += `### 📈 Statistical Analysis\n`;
    summary.insights.statistical.forEach(stat => {
      response += `• ${stat}\n`;
    });
    response += `\n`;
  }
  
  // Business insights
  if (summary.insights.business.length > 0) {
    response += `### 💼 Business Implications\n`;
    summary.insights.business.forEach(business => {
      response += `• ${business}\n`;
    });
    response += `\n`;
  }
  
  // Analysis output
  if (summary.analysisOutput) {
    response += `### 🐍 Python Analysis Output\n\`\`\`\n${summary.analysisOutput}\n\`\`\`\n\n`;
  }
  
  // Generated files
  if (summary.generatedFiles && summary.generatedFiles.length > 0) {
    response += `### 📁 Generated Files\n`;
    summary.generatedFiles.forEach(file => {
      response += `• ${file.filename} (${Math.round(file.size/1024)}KB)\n`;
    });
    response += `\n`;
  }
  
  // Recommendations
  if (summary.recommendations.length > 0) {
    response += `### 🎯 Recommendations\n`;
    summary.recommendations.forEach(rec => {
      response += `• ${rec}\n`;
    });
    response += `\n`;
  }
  
  // Follow-up questions
  if (summary.followUpQuestions.length > 0) {
    response += `### ❓ Suggested Follow-up Questions\n`;
    summary.followUpQuestions.forEach(question => {
      response += `• ${question}\n`;
    });
  }
  
  return response;
}