
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
data_file = "/Users/abdulmannan/Desktop/Development/EcomAnalysisAgent/data/queries/query_cli_1753608925989_418r9pij5_2025-07-27T09-35-36-723Z.json"
output_dir = "/Users/abdulmannan/Desktop/Development/EcomAnalysisAgent/data/analysis/session_cli_1753608925989_418r9pij5_2025-07-27T09-35-46-152Z"
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
 {"product_id": "9761514389771", "total_revenue": 9841.599999999991},
 {"product_id": "8431711813900", "total_revenue": 9097.980000000001},
 {"product_id": "8817190633739", "total_revenue": 7971.900000000003},
 {"product_id": "8349989437707", "total_revenue": 6745.2},
 {"product_id": "9761513996555", "total_revenue": 5588.800000000002},
 {"product_id": "8817194893579", "total_revenue": 4906.700000000002},
 {"product_id": "8555677778188", "total_revenue": 3881.6700000000064},
 {"product_id": "8817193746699", "total_revenue": 3300.4000000000015},
 {"product_id": "3625626599504", "total_revenue": 3006.16},
 {"product_id": "8555621810444", "total_revenue": 2743.800000000002}
]

# Create a DataFrame
df = pd.DataFrame(data)

# Sort the DataFrame by total_revenue in descending order
df_sorted = df.sort_values(by='total_revenue', ascending=False)

# Select the top 10 products
top_10_products = df_sorted.head(10)

# Plotting
plt.figure(figsize=(10, 6))
plt.bar(top_10_products['product_id'], top_10_products['total_revenue'], color='skyblue')
plt.xlabel('Product ID')
plt.ylabel('Total Revenue')
plt.title('Top 10 Best-Selling Products by Revenue')
plt.xticks(rotation=45, ha='right')
plt.tight_layout()

# Save the plot
# output_dir already defined above # Change this to your desired output directory
output_file = os.path.join(output_dir, 'top_10_best_selling_products.png')
plt.savefig(output_file)
plt.close()

# Output the sorted DataFrame to a CSV file
csv_output_file = os.path.join(output_dir, 'top_10_best_selling_products.csv')
top_10_products.to_csv(csv_output_file, index=False)


print("Analysis completed successfully!")
