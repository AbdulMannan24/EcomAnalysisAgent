export const SYSTEM_LIMITS = {
  MAX_ROWS: 10000,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  OPENAI_CHUNK_SIZE: 10 * 1024 * 1024, // 10MB for OpenAI
  QUERY_TIMEOUT: 30000, // 30 seconds
  MAX_SAMPLE_SIZE: 30,
  MAX_STRING_LENGTH: 80,
  MAX_CHARS_PER_SAMPLE: 8000,
  MAX_RETRIES: 3
} as const;

export const AI_MODELS = {
  VALIDATION: 'gpt-4o-mini',
  QUERY_GENERATION: 'gpt-4o-mini', 
  ANALYSIS_STRATEGY: 'gpt-4o',
  ERROR_FIXING: 'gpt-4o-mini'
} as const;

export const TOKEN_LIMITS = {
  VALIDATION: 800,
  QUERY_GENERATION: 800,
  ANALYSIS_STRATEGY: 2000,
  ERROR_FIXING: 1000
} as const;

export const TABLE_MAPPINGS = {
  SALES_FACT: ['cortex_3_facts.fct_sales', 'cortex_3_facts.fct_webhook_sales'],
  PRODUCT_DIM: ['cortex_2_dimensions.dim_product'],
  VARIANT_DIM: ['cortex_2_dimensions.dim_variant']
} as const;

export const COLUMN_LOCATIONS = {
  INVENTORY: 'dim_variant',
  SALES_AMOUNT: 'fct_sales',
  PRODUCT_INFO: 'dim_product',
  SHOP_DATA: 'fct_sales'
} as const;

export const PYTHON_PACKAGES = [
  'pandas',
  'matplotlib', 
  'seaborn',
  'numpy'
] as const;