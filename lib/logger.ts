// @ts-nocheck
import fs from 'fs/promises';
import path from 'path';

export class Logger {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
    this.currentSession = null;
    this.stats = {
      queriesExecuted: 0,
      modelCalls: 0,
      modelCallsByType: {},
      retryAttempts: 0,
      errors: 0,
      startTime: null,
      endTime: null
    };
    this.consoleBuffer = [];
    this.originalConsole = {};
    this.interceptConsole();
  }

  async initializeSession(sessionId, userQuery) {
    this.currentSession = {
      sessionId,
      userQuery,
      startTime: new Date().toISOString(),
      logFile: path.join(this.logsDir, `session_${sessionId}.log`),
      statsFile: path.join(this.logsDir, `stats_${sessionId}.json`)
    };

    // Ensure logs directory exists
    await fs.mkdir(this.logsDir, { recursive: true });
    
    // Reset stats for new session
    this.stats = {
      queriesExecuted: 0,
      modelCalls: 0,
      modelCallsByType: {},
      retryAttempts: 0,
      errors: 0,
      startTime: new Date().toISOString(),
      endTime: null
    };

    await this.log('SESSION_START', `User Query: "${userQuery}"`);
    await this.log('SYSTEM', `Session ID: ${sessionId}`);
  }

  async log(level, message, data = null) {
    if (!this.currentSession) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: data ? JSON.stringify(data, null, 2) : null
    };

    const logLine = `[${timestamp}] ${level}: ${message}${data ? `\nData: ${JSON.stringify(data, null, 2)}` : ''}\n`;
    
    try {
      await fs.appendFile(this.currentSession.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  // Track model API calls
  async logModelCall(model, prompt, response, tokens = null) {
    this.stats.modelCalls++;
    this.stats.modelCallsByType[model] = (this.stats.modelCallsByType[model] || 0) + 1;

    await this.log('MODEL_CALL', `Called ${model}`, {
      model,
      promptLength: prompt.length,
      responseLength: response.length,
      tokens,
      callNumber: this.stats.modelCalls
    });
  }

  // Track database queries
  async logQuery(query, success, rowCount = 0, error = null) {
    this.stats.queriesExecuted++;
    
    if (!success) {
      this.stats.errors++;
    }

    await this.log('DATABASE_QUERY', `Query ${success ? 'SUCCESS' : 'FAILED'}`, {
      query,
      success,
      rowCount,
      error,
      queryNumber: this.stats.queriesExecuted
    });
  }

  // Track retry attempts
  async logRetry(type, attempt, reason, success = false) {
    this.stats.retryAttempts++;

    await this.log('RETRY', `${type} retry attempt ${attempt}`, {
      type,
      attempt,
      reason,
      success,
      totalRetries: this.stats.retryAttempts
    });
  }

  // Track errors
  async logError(error, context = null) {
    this.stats.errors++;

    await this.log('ERROR', error.message || error, {
      error: error.stack || error,
      context,
      errorNumber: this.stats.errors
    });
  }

  // Track Python script execution
  async logPythonExecution(scriptPath, success, output, error = null) {
    await this.log('PYTHON_SCRIPT', `Python execution ${success ? 'SUCCESS' : 'FAILED'}`, {
      scriptPath,
      success,
      output: output.substring(0, 1000), // Limit output length
      error
    });
  }

  // Intercept console output
  interceptConsole() {
    const logLevels = ['log', 'info', 'warn', 'error'];
    
    logLevels.forEach(level => {
      this.originalConsole[level] = console[level].bind(console);
      
      console[level] = (...args) => {
        // Call original console method
        this.originalConsole[level](...args);
        
        // Buffer console output
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        this.consoleBuffer.push({
          timestamp: new Date().toISOString(),
          level: level.toUpperCase(),
          message
        });
        
        // Log to file if session is active
        if (this.currentSession) {
          this.log(`CONSOLE_${level.toUpperCase()}`, message);
        }
      };
    });
  }

  // Save console output to file
  async saveConsoleOutput() {
    if (!this.currentSession || this.consoleBuffer.length === 0) return;

    const consoleLogFile = path.join(this.logsDir, `console_${this.currentSession.sessionId}.log`);
    const consoleOutput = this.consoleBuffer.map(entry => 
      `[${entry.timestamp}] ${entry.level}: ${entry.message}`
    ).join('\n');

    try {
      await fs.writeFile(consoleLogFile, consoleOutput);
      await this.log('SYSTEM', `Console output saved to ${consoleLogFile}`);
    } catch (error) {
      console.error('Failed to save console output:', error);
    }
  }

  // Finalize session and save stats
  async finalizeSession(success = true, finalData = null) {
    if (!this.currentSession) return;

    this.stats.endTime = new Date().toISOString();
    const duration = new Date(this.stats.endTime).getTime() - new Date(this.stats.startTime).getTime();
    this.stats.durationMs = duration;
    this.stats.durationSeconds = Math.round(duration / 1000);

    await this.log('SESSION_END', `Session completed ${success ? 'successfully' : 'with errors'}`, {
      success,
      finalData,
      stats: this.stats
    });

    // Save detailed stats
    const statsData = {
      sessionId: this.currentSession.sessionId,
      userQuery: this.currentSession.userQuery,
      success,
      stats: this.stats,
      summary: {
        totalQueries: this.stats.queriesExecuted,
        totalModelCalls: this.stats.modelCalls,
        modelBreakdown: this.stats.modelCallsByType,
        totalRetries: this.stats.retryAttempts,
        totalErrors: this.stats.errors,
        duration: `${this.stats.durationSeconds}s`,
        errorRate: this.stats.queriesExecuted > 0 ? (this.stats.errors / this.stats.queriesExecuted * 100).toFixed(2) + '%' : '0%'
      }
    };

    try {
      await fs.writeFile(this.currentSession.statsFile, JSON.stringify(statsData, null, 2));
    } catch (error) {
      console.error('Failed to save stats file:', error);
    }

    // Save console output
    await this.saveConsoleOutput();

    // Reset for next session
    this.currentSession = null;
    this.consoleBuffer = [];
  }

  // Get current session stats
  getCurrentStats() {
    return { ...this.stats };
  }
}