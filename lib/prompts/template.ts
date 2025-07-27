export class PromptTemplate {
  static interpolate(template: string, variables: Record<string, any>): string {
    return template.replace(/\${([^}]+)}/g, (match, key) => {
      const value = this.getNestedValue(variables, key.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  static formatSchemaForPrompt(schemas: Map<string, any>): string {
    return Array.from(schemas.entries())
      .map(([tableName, schema]) => {
        const columns = schema.columns || [];
        const columnsByType = columns.reduce((acc: Record<string, string[]>, col: any) => {
          const baseType = col.type.replace(/Nullable\(|\)/g, '').split('(')[0];
          if (!acc[baseType]) acc[baseType] = [];
          acc[baseType].push(col.name);
          return acc;
        }, {});
        
        return `═══ TABLE: ${tableName} ═══
AVAILABLE COLUMNS (${columns.length} total):
${columns.map((col: any) => `  ✓ ${col.name} (${col.type})`).join('\n')}

COLUMNS BY DATA TYPE:
${Object.entries(columnsByType).map(([type, cols]) => `  ${type}: ${cols.join(', ')}`).join('\n')}

❌ CRITICAL: Only use columns listed above - others will cause errors.`;
      })
      .join('\n\n');
  }
}