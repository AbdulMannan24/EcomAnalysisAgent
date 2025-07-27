import { spawn } from 'child_process';
import { Logger } from '../logger';

export class PythonExecutor {
  static async execute(scriptPath: string, logger?: Logger): Promise<{
    success: boolean;
    output: string;
    error: string | null;
  }> {
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
        
        // Log Python execution if logger is provided
        if (logger) {
          logger.logPythonExecution(scriptPath, success, output, error);
        }
        
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
}