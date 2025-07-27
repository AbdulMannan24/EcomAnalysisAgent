
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
data_file = "/Users/abdulmannan/Desktop/Development/EcomAnalysisAgent/data/queries/query_cli_1753612197529_y1ehuwtda_2025-07-27T10-30-09-103Z.json"
output_dir = "/Users/abdulmannan/Desktop/Development/EcomAnalysisAgent/data/analysis/session_cli_1753612197529_y1ehuwtda_2025-07-27T10-30-18-639Z"
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
 {"date_id": "2025-06-27", "average_order_value": 2.057815845824411},
 {"date_id": "2025-06-28", "average_order_value": 2.23728813559322},
 {"date_id": "2025-06-29", "average_order_value": 1.7962790697674418},
 {"date_id": "2025-06-30", "average_order_value": 1.8349944629014396},
 {"date_id": "2025-07-01", "average_order_value": 1.972027972027972},
 {"date_id": "2025-07-02", "average_order_value": 2.509761388286334},
 {"date_id": "2025-07-03", "average_order_value": 1.9739130434782608},
 {"date_id": "2025-07-04", "average_order_value": 1.9431279620853081},
 {"date_id": "2025-07-05", "average_order_value": 1.8338870431893688},
 {"date_id": "2025-07-06", "average_order_value": 1.936608557844691},
 {"date_id": "2025-07-07", "average_order_value": 2.050218340611354},
 {"date_id": "2025-07-08", "average_order_value": 2.3816964285714284},
 {"date_id": "2025-07-09", "average_order_value": 2.3658536585365852},
 {"date_id": "2025-07-10", "average_order_value": 2.110344827586207},
 {"date_id": "2025-07-11", "average_order_value": 1.864864864864865}
]

# Convert data to DataFrame
df = pd.DataFrame(data)

# Convert date_id to datetime
df['date_id'] = pd.to_datetime(df['date_id'])

# Calculate statistical metrics
mean_value = df['average_order_value'].mean()
median_value = df['average_order_value'].median()
std_dev = df['average_order_value'].std()

# Print statistical metrics
print(f"Mean Average Order Value: {mean_value}")
print(f"Median Average Order Value: {median_value}")
print(f"Standard Deviation: {std_dev}")

# Plot the data
plt.figure(figsize=(10, 6))
plt.plot(df['date_id'], df['average_order_value'], marker='o', linestyle='-')
plt.title('Average Order Value Over Time')
plt.xlabel('Date')
plt.ylabel('Average Order Value')
plt.grid(True)

# Save the plot
# output_dir already defined above # Change this to your desired output directory
plot_filename = os.path.join(output_dir, 'average_order_value_trend.png')
plt.savefig(plot_filename)
plt.show()

print("Analysis completed successfully!")
