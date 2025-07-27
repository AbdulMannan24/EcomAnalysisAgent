# EcomAnalysisAgent - Coding Standards & Architecture

## Project Architecture

### Core Principles
1. **Modularity**: Break down large files into focused, single-responsibility modules
2. **Context Efficiency**: Minimize model context usage by extracting prompts and reusable utilities
3. **Scalability**: Design for easy extension and maintenance
4. **Type Safety**: Use TypeScript effectively while prioritizing functionality over strict typing

### Directory Structure
```
lib/
├── config/           # Configuration and constants
├── prompts/          # AI prompt templates (isolated from business logic)
├── services/         # Core business logic services
├── utils/            # Reusable utility functions
├── database-tools.ts # Database interaction layer
├── logger.ts         # Logging functionality
├── script-validator.ts # Python script validation
├── schema-debugger.ts  # Schema debugging utilities
└── query-error-handler.ts # SQL error handling
```

## Coding Standards

### 1. File Organization
- **Maximum file size**: 300 lines (excluding imports/exports)
- **Single responsibility**: Each file should have one clear purpose
- **Clear naming**: Use descriptive names that indicate the file's function

### 2. AI Context Optimization
- **Separate prompts**: Extract all AI prompts to dedicated template files
- **Minimize prompt size**: Use template interpolation for dynamic content
- **Reusable utilities**: Extract common logic to utility functions
- **Constants**: Define all magic numbers and strings in config files

### 3. Import/Export Patterns
```typescript
// Good: Barrel exports for clean imports
export { SchemaService, QueryService } from './services';

// Good: Specific imports to reduce bundle size
import { SYSTEM_LIMITS, AI_MODELS } from './config';

// Bad: Importing entire modules when only specific functions needed
import * as fs from 'fs';
```

### 4. Error Handling
- Always provide fallback strategies for AI failures
- Log errors with context for debugging
- Use structured error responses with actionable messages
- Implement retry logic for recoverable errors

### 5. Configuration Management
- Use environment variables for all external dependencies
- Validate configuration on startup
- Centralize all constants and limits
- Support different environments (dev, prod)

## AI Prompt Management

### Prompt Template Structure
```typescript
export class QueryValidationPrompts {
  static create(userQuery: string, schemas: any): string {
    // Template with minimal, focused content
    return `...focused prompt content...`;
  }
}
```

### Context Reduction Strategies
1. **Extract static text**: Move boilerplate text to template constants
2. **Use schema summaries**: Don't include full schema data in prompts
3. **Selective information**: Only include relevant data for each prompt
4. **Template interpolation**: Use dynamic insertion for variable content

## Service Layer Design

### Service Responsibilities
- **SchemaService**: Database schema caching and management
- **QueryService**: SQL query validation, generation, and execution
- **AnalysisService**: Data analysis strategy and Python script execution

### Service Communication
- Services communicate through well-defined interfaces
- Minimal coupling between services
- Shared state only through dependency injection

## Utility Functions

### Guidelines
- Pure functions when possible (no side effects)
- Single responsibility per utility
- Comprehensive error handling
- Type-safe implementations

### Examples
```typescript
// Good: Focused utility with clear purpose
export class DataSampler {
  static sampleForAnalysis(data: any[]): any[] {
    // Implementation
  }
}

// Bad: Mixed responsibilities
export class DataUtils {
  static sample(data: any[]): any[] { /* */ }
  static saveFile(path: string): void { /* */ }
  static parseJSON(text: string): any { /* */ }
}
```

## Database Integration

### Schema Management
- Cache schemas on startup
- Validate column existence before query generation
- Provide clear error messages for schema mismatches
- Log schema debugging information

### Query Generation
- Use type-safe casting patterns
- Implement pre-execution validation
- Support automatic error recovery
- Follow ClickHouse best practices

## Python Script Integration

### Script Generation
- Validate scripts before execution
- Provide comprehensive error handling
- Use structured output formats
- Support automatic fixes for common issues

### Execution Environment
- Isolated execution with timeouts
- Proper file path management
- Real-time output logging
- Resource cleanup

## Testing Strategy

### Unit Testing
- Test individual utilities and services
- Mock external dependencies
- Validate error handling paths
- Test edge cases and boundary conditions

### Integration Testing  
- Test service interactions
- Validate AI prompt responses
- Test database connections
- Verify Python script execution

## Performance Considerations

### Memory Management
- Stream large datasets when possible
- Implement data sampling for analysis
- Clean up temporary files
- Monitor memory usage in production

### Context Limits
- Keep AI prompts under token limits
- Use efficient data structures
- Implement pagination for large result sets
- Cache frequently accessed data

## Deployment & Monitoring

### Environment Setup
- Document all required environment variables
- Provide setup scripts for dependencies
- Support Docker containerization
- Include health check endpoints

### Monitoring
- Log all AI model calls with metadata
- Track query execution times
- Monitor error rates and types
- Implement alerting for failures

## Migration Path

### From Legacy Code
1. Create new modular structure alongside existing code
2. Gradually migrate functionality to new services
3. Update imports to use new modules
4. Remove legacy code once migration is complete
5. Update tests and documentation

### Backward Compatibility
- Maintain existing public APIs during migration
- Provide deprecation warnings for old patterns
- Support gradual adoption of new standards
- Document breaking changes clearly