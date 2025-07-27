import fs from 'fs/promises';
import path from 'path';
import { SYSTEM_LIMITS } from '../config/constants';

export class FileManager {
  static async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.warn(`Directory creation warning for ${dirPath}:`, error.message);
    }
  }

  static async saveQueryResult(
    data: any, 
    sessionId: string, 
    dataDir: string
  ): Promise<{ filepath: string; filename: string; dataSize: number }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `query_${sessionId}_${timestamp}.json`;
    const filepath = path.join(dataDir, 'queries', filename);
    
    await this.ensureDirectoryExists(path.dirname(filepath));
    
    const dataSize = JSON.stringify(data).length;
    if (dataSize > SYSTEM_LIMITS.MAX_FILE_SIZE) {
      throw new Error(
        `Data size (${Math.round(dataSize/1024/1024)}MB) exceeds limit (${Math.round(SYSTEM_LIMITS.MAX_FILE_SIZE/1024/1024)}MB)`
      );
    }

    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    
    return { filepath, filename, dataSize };
  }

  static async savePythonScript(
    scriptContent: string, 
    sessionId: string, 
    dataDir: string
  ): Promise<{ scriptPath: string; outputDir: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const scriptFilename = `analysis_${sessionId}_${timestamp}.py`;
    const scriptPath = path.join(dataDir, 'scripts', scriptFilename);
    const outputDir = path.join(dataDir, 'analysis', `session_${sessionId}_${timestamp}`);

    await this.ensureDirectoryExists(path.dirname(scriptPath));
    await this.ensureDirectoryExists(outputDir);
    
    await fs.writeFile(scriptPath, scriptContent);
    
    return { scriptPath, outputDir };
  }

  static async getOutputFiles(outputDir: string): Promise<Array<{
    filename: string;
    filepath: string;
    size: number;
    type: string;
  }>> {
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
}