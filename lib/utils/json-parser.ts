export class JSONParser {
  static parseAIResponse(text: string): any {
    let cleanResponse = text.trim();
    
    // Strategy 1: Remove markdown code blocks
    if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```json\s*/m, '').replace(/\s*```$/m, '');
    }
    
    // Strategy 2: Find JSON object boundaries
    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanResponse = jsonMatch[0];
    }
    
    // Strategy 3: Remove any trailing text after JSON
    const lastBraceIndex = cleanResponse.lastIndexOf('}');
    if (lastBraceIndex !== -1) {
      cleanResponse = cleanResponse.substring(0, lastBraceIndex + 1);
    }
    
    // Strategy 4: Fix common JSON issues
    cleanResponse = cleanResponse
      .replace(/,\s*}/g, '}')  // Remove trailing commas
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/\n/g, ' ')     // Replace newlines with spaces
      .replace(/\t/g, ' ')     // Replace tabs with spaces
      .replace(/\s+/g, ' ');   // Normalize whitespace
    
    try {
      return JSON.parse(cleanResponse);
    } catch (parseError) {
      console.warn('Primary JSON parse failed, attempting repair...', parseError.message);
      
      // Strategy 5: Try to extract and fix JSON structure
      try {
        // Find the first { and last }
        const firstBrace = cleanResponse.indexOf('{');
        const lastBrace = cleanResponse.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const extractedJson = cleanResponse.substring(firstBrace, lastBrace + 1);
          return JSON.parse(extractedJson);
        }
      } catch (repairError) {
        console.error('JSON repair failed:', repairError.message);
        console.error('Raw AI response length:', text.length);
        console.error('First 500 chars:', text.substring(0, 500));
        throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
      }
      
      throw parseError;
    }
  }
}