
import json
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import os
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Set up paths
data_file = "/Users/abdulmannan/Desktop/Development/EcomAnalysisAgent/data/queries/query_cli_1753610560780_wr5efuwhw_2025-07-27T10-02-54-660Z.json"
output_dir = "/Users/abdulmannan/Desktop/Development/EcomAnalysisAgent/data/analysis/session_cli_1753610560780_wr5efuwhw_2025-07-27T10-03-07-677Z"
os.makedirs(output_dir, exist_ok=True)

# Load data
with open(data_file, 'r') as f:
    file_data = json.load(f)
    
data = file_data['data']
df = pd.DataFrame(data)

print(f"Loaded {len(df)} rows with columns: {list(df.columns)}")

# User's analysis script (with fixed paths)
# Import necessary libraries
import pandas as pd
import matplotlib.pyplot as plt
import os

# Sample data
data = [
 {"currency_code": "EUR", "month": "2025-01-01", "total_amount": 7499},
 {"currency_code": "EUR", "month": "2025-02-01", "total_amount": 42230},
 {"currency_code": "CHF", "month": "2025-03-01", "total_amount": 34},
 {"currency_code": "DKK", "month": "2025-03-01", "total_amount": 2},
 {"currency_code": "EUR", "month": "2025-03-01", "total_amount": 41379},
 {"currency_code": "GBP", "month": "2025-03-01", "total_amount": 2},
 {"currency_code": "CHF", "month": "2025-04-01", "total_amount": 396},
 {"currency_code": "CZK", "month": "2025-04-01", "total_amount": 1},
 {"currency_code": "DKK", "month": "2025-04-01", "total_amount": 1},
 {"currency_code": "EUR", "month": "2025-04-01", "total_amount": 43269},
 {"currency_code": "GBP", "month": "2025-04-01", "total_amount": 705},
 {"currency_code": "PLN", "month": "2025-04-01", "total_amount": 2},
 {"currency_code": "XOF", "month": "2025-04-01", "total_amount": 2},
 {"currency_code": "CHF", "month": "2025-05-01", "total_amount": 26},
 {"currency_code": "EUR", "month": "2025-05-01", "total_amount": 11475},
 {"currency_code": "GBP", "month": "2025-05-01", "total_amount": 433},
 {"currency_code": "USD", "month": "2025-05-01", "total_amount": 1},
 {"currency_code": "EUR", "month": "2025-06-01", "total_amount": 63302},
 {"currency_code": "GBP", "month": "2025-06-01", "total_amount": 480},
 {"currency_code": "EUR", "month": "2025-07-01", "total_amount": 58027},
 {"currency_code": "GBP", "month": "2025-07-01", "total_amount": 184}
]

# Create a DataFrame
df = pd.DataFrame(data)

# Convert 'month' to datetime
df['month'] = pd.to_datetime(df['month'])

# Calculate total amount received each month for each currency
monthly_totals = df.groupby(['currency_code', df['month'].dt.to_period('M')])['total_amount'].sum().unstack().fillna(0)

# Plot the data
plt.figure(figsize=(10, 6))
for currency in monthly_totals.index:
 plt.plot(monthly_totals.columns.astype(str), monthly_totals.loc[currency], label=currency)

plt.title('Total Amount Received Each Month by Currency')
plt.xlabel('Month')
plt.ylabel('Total Amount')
plt.legend(title='Currency')
plt.xticks(rotation=45)
plt.tight_layout()

# Save the plot
# output_dir already defined above # Change this to your desired output directory
plt.savefig(os.path.join(output_dir, 'currency_trends.png'))
plt.show()

print("Analysis completed successfully!")
