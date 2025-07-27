
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
data_file = "/Users/abdulmannan/Desktop/Development/EcomAnalysisAgent/data/queries/query_cli_1753611688112_zybd3idd4_2025-07-27T10-21-39-469Z.json"
output_dir = "/Users/abdulmannan/Desktop/Development/EcomAnalysisAgent/data/analysis/session_cli_1753611688112_zybd3idd4_2025-07-27T10-21-52-695Z"
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
 {"week_start": 20114, "month": 1, "AoV": 2.0528332877087325},
 {"week_start": 20114, "month": 2, "AoV": 3.1363636363636362},
 {"week_start": 20121, "month": 2, "AoV": 1.9166666666666667},
 {"week_start": 20128, "month": 2, "AoV": 2.200932684509327},
 {"week_start": 20135, "month": 2, "AoV": 2.073238023576624},
 {"week_start": 20142, "month": 2, "AoV": 2.2352652259332024},
 {"week_start": 20142, "month": 3, "AoV": 2.5936507936507938},
 {"week_start": 20149, "month": 3, "AoV": 2.3724366706875752},
 {"week_start": 20156, "month": 3, "AoV": 1.8691993880673126},
 {"week_start": 20163, "month": 3, "AoV": 1.9243580846634283},
 {"week_start": 20170, "month": 3, "AoV": 1.8450892857142858},
 {"week_start": 20177, "month": 3, "AoV": 1.7094890510948906},
 {"week_start": 20177, "month": 4, "AoV": 1.6585778781038374},
 {"week_start": 20184, "month": 4, "AoV": 1.9924043236926672},
 {"week_start": 20191, "month": 4, "AoV": 1.4769470058882346},
 {"week_start": 20198, "month": 4, "AoV": 1.818765036086608},
 {"week_start": 20205, "month": 4, "AoV": 1.5437665782493368},
 {"week_start": 20205, "month": 5, "AoV": 1.930298719772404},
 {"week_start": 20212, "month": 5, "AoV": 1.8661604176554343},
 {"week_start": 20254, "month": 6, "AoV": 2.201709401709402},
 {"week_start": 20261, "month": 6, "AoV": 2.006242568370987},
 {"week_start": 20268, "month": 6, "AoV": 1.813953488372093},
 {"week_start": 20268, "month": 7, "AoV": 2.0233368164402648},
 {"week_start": 20275, "month": 7, "AoV": 2.1396131202691335}
]

# Create a DataFrame
df = pd.DataFrame(data)

# Calculate average AoV per month
aov_monthly = df.groupby('month')['AoV'].mean().reset_index()

# Plot AoV trends
plt.figure(figsize=(10, 6))
plt.plot(df['week_start'], df['AoV'], marker='o', linestyle='-')
plt.title('Weekly Average Order Value (AoV) Trend')
plt.xlabel('Week Start')
plt.ylabel('Average Order Value (AoV)')
plt.grid(True)

# Save the plot
# output_dir already defined above # Change this to your desired output directory
plt.savefig(os.path.join(output_dir, 'weekly_aov_trend.png'))
plt.close()

# Print statistical summary
print(aov_monthly)


print("Analysis completed successfully!")
