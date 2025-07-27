# CLI Setup - Quick Start

## Install Everything (One Time)

```bash
# Install Node packages
npm install

# Install Python packages
pip install pandas matplotlib seaborn numpy
```

## Create .env file
refer the .env.example file for this

## Run the CLI

```bash
npm run cli
```

That's it! The CLI tool will start in your terminal.

## If npm run cli doesn't work

```bash
# Option 1: Direct run with tsx
npx tsx cli.ts

# Option 2: Install tsx globally and run
npm install -g tsx
tsx cli.ts
```

## Common Issues

**Python modules not found?**
```bash
pip install pandas matplotlib seaborn numpy
```

**Database connection failed?**
- Check your DATABASE_URL in .env file
- Make sure your database is running

**OpenAI API error?**
- Verify your OPENAI_API_KEY in .env file