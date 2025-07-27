import { SYSTEM_LIMITS } from '../config/constants';

export class DataSampler {
  static sampleForAnalysis(data: any[], maxSamples = SYSTEM_LIMITS.MAX_SAMPLE_SIZE): any[] {
    if (data.length <= maxSamples) {
      return data;
    }

    // Smart sampling: take start, middle, end
    const third = Math.floor(maxSamples / 3);
    const start = data.slice(0, third);
    const middle = data.slice(
      Math.floor(data.length / 2) - Math.floor(third / 2), 
      Math.floor(data.length / 2) + Math.floor(third / 2)
    );
    const end = data.slice(-third);
    
    return [...start, ...middle, ...end];
  }

  static truncateLongStrings(data: any[], maxLength = SYSTEM_LIMITS.MAX_STRING_LENGTH): any[] {
    return data.map(row => {
      const processed: Record<string, any> = {};
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' && value.length > maxLength) {
          processed[key] = value.substring(0, maxLength) + '...';
        } else {
          processed[key] = value;
        }
      }
      return processed;
    });
  }

  static prepareForAnalysis(data: any[], rowCount: number): {
    sampleData: any[];
    sampleSize: number;
    totalRows: number;
  } {
    let sampleData = this.sampleForAnalysis(data);
    sampleData = this.truncateLongStrings(sampleData);
    
    return {
      sampleData,
      sampleSize: sampleData.length,
      totalRows: rowCount
    };
  }
}