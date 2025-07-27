
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
data_file = "/Users/abdulmannan/Desktop/Development/EcomAnalysisAgent/data/queries/query_cli_1753611357227_n8vj9vo53_2025-07-27T10-16-08-883Z.json"
output_dir = "/Users/abdulmannan/Desktop/Development/EcomAnalysisAgent/data/analysis/session_cli_1753611357227_n8vj9vo53_2025-07-27T10-16-21-491Z"
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
 {"week_start": "2025-01-26", "average_order_value": 6.368589710107088},
 {"week_start": "2025-02-02", "average_order_value": 5.708743589743539},
 {"week_start": "2025-02-09", "average_order_value": 6.498183292781907},
 {"week_start": "2025-02-16", "average_order_value": 6.565512916980262},
 {"week_start": "2025-02-23", "average_order_value": 6.027572372920025},
 {"week_start": "2025-03-02", "average_order_value": 7.023419782870975},
 {"week_start": "2025-03-09", "average_order_value": 6.254530851606345},
 {"week_start": "2025-03-16", "average_order_value": 6.269585935692915},
 {"week_start": "2025-03-23", "average_order_value": 10.909535714285795},
 {"week_start": "2025-03-30", "average_order_value": 35.39057447485733},
 {"week_start": "2025-04-06", "average_order_value": 16.636348232544684},
 {"week_start": "2025-04-13", "average_order_value": 51.48321186535234},
 {"week_start": "2025-04-20", "average_order_value": 23.596281074578844},
 {"week_start": "2025-04-27", "average_order_value": 28.783506940178302},
 {"week_start": "2025-05-04", "average_order_value": 16.138281917418336},
 {"week_start": "2025-06-15", "average_order_value": 7.656871794871746},
 {"week_start": "2025-06-22", "average_order_value": 6.6678686087990755},
 {"week_start": "2025-06-29", "average_order_value": 6.184937100433069},
 {"week_start": "2025-07-06", "average_order_value": 7.0792935239697234}
]

# Create DataFrame
df = pd.DataFrame(data)

# Convert week_start to datetime
df['week_start'] = pd.to_datetime(df['week_start'])

# Set week_start as index
df.set_index('week_start', inplace=True)

# Plot average order value over time
plt.figure(figsize=(12, 6))
plt.plot(df.index, df['average_order_value'], marker='o', linestyle='-')
plt.title('Average Order Value Over Time')
plt.xlabel('Week Start')
plt.ylabel('Average Order Value')
plt.grid(True)
plt.xticks(rotation=45)

# Save plot
# output_dir already defined above # Change this to your desired output directory
plt.savefig(os.path.join(output_dir, 'average_order_value_trend.png'))
plt.show()


print("Analysis completed successfully!")
