import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PYTHON_PACKAGES } from './config';

export class ScriptValidator {
  private requiredPackages = PYTHON_PACKAGES;
  
  async validatePythonScript(scriptContent: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 1. Check syntax
    const syntaxCheck = await this.checkSyntax(scriptContent);
    if (!syntaxCheck.valid) {
      errors.push(`Syntax error: ${syntaxCheck.error}`);
    }
    
    // 2. Check for common issues
    const issues = this.checkCommonIssues(scriptContent);
    errors.push(...issues.errors);
    warnings.push(...issues.warnings);
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  private async checkSyntax(scriptContent: string): Promise<{ valid: boolean; error?: string }> {
    const tempFile = path.join(process.cwd(), `temp_syntax_check_${Date.now()}.py`);
    
    try {
      await fs.writeFile(tempFile, scriptContent);
      
      const result = await new Promise<{ success: boolean; error: string }>((resolve) => {
        const python = spawn('python3', ['-m', 'py_compile', tempFile]);
        let error = '';
        
        python.stderr.on('data', (data) => {
          error += data.toString();
        });
        
        python.on('close', (code) => {
          resolve({
            success: code === 0,
            error: error
          });
        });
      });
      
      return {
        valid: result.success,
        error: result.error
      };
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
  
  private checkCommonIssues(scriptContent: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check for file path issues
    if (scriptContent.includes("pd.read_json('ecommerce_data.json')")) {
      errors.push("Script tries to read from non-existent 'ecommerce_data.json' file");
    }
    
    // Check for missing data parameter in seaborn plots
    const seabornPattern = /sns\.\w+\([^)]*\)/g;
    const matches = scriptContent.match(seabornPattern) || [];
    for (const match of matches) {
      if (!match.includes('data=') && (match.includes('x=') || match.includes('y='))) {
        warnings.push(`Seaborn plot might be missing 'data=' parameter: ${match}`);
      }
    }
    
    // Check for hardcoded file paths
    if (scriptContent.match(/\.savefig\(['"](?!.*output_dir)/)) {
      warnings.push("Script saves files without using output_dir path");
    }
    
    // Check for unbalanced parentheses
    const openParens = (scriptContent.match(/\(/g) || []).length;
    const closeParens = (scriptContent.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push(`Unbalanced parentheses: ${openParens} opening, ${closeParens} closing`);
    }
    
    return { errors, warnings };
  }
  
  async checkDependencies(): Promise<{
    installed: string[];
    missing: string[];
  }> {
    const installed: string[] = [];
    const missing: string[] = [];
    
    for (const pkg of this.requiredPackages) {
      const isInstalled = await this.isPackageInstalled(pkg);
      if (isInstalled) {
        installed.push(pkg);
      } else {
        missing.push(pkg);
      }
    }
    
    return { installed, missing };
  }
  
  private async isPackageInstalled(packageName: string): Promise<boolean> {
    return new Promise((resolve) => {
      const python = spawn('python3', ['-c', `import ${packageName}`]);
      
      python.on('close', (code) => {
        resolve(code === 0);
      });
      
      python.on('error', () => {
        resolve(false);
      });
    });
  }
  
  async installMissingDependencies(packages: string[]): Promise<{
    success: boolean;
    output: string;
    error?: string;
  }> {
    if (packages.length === 0) {
      return { success: true, output: 'No packages to install' };
    }
    
    return new Promise((resolve) => {
      const pip = spawn('pip3', ['install', ...packages]);
      let output = '';
      let error = '';
      
      pip.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pip.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      pip.on('close', (code) => {
        resolve({
          success: code === 0,
          output,
          error: error || undefined
        });
      });
      
      pip.on('error', (err) => {
        resolve({
          success: false,
          output,
          error: err.message
        });
      });
    });
  }
}