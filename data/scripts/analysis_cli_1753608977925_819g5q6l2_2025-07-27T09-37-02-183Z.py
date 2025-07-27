
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
data_file = "/Users/abdulmannan/Desktop/Development/EcomAnalysisAgent/data/queries/query_cli_1753608977925_819g5q6l2_2025-07-27T09-36-30-052Z.json"
output_dir = "/Users/abdulmannan/Desktop/Development/EcomAnalysisAgent/data/analysis/session_cli_1753608977925_819g5q6l2_2025-07-27T09-37-02-183Z"
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
 {"p.product_id": "8431711813900", "product_title": "SAMYANG Instant Nudeln Hot Chicken Carbonara 130g", "product_url": "https://mao-mao.de/products/samyang-instant-ramen-hot-chicken-carbonara-130g", "product_type": "Hot Deal", "vendor": "Samyang", "total_revenue": 9358.74},
 {"p.product_id": "8555677778188", "product_title": "SAMYANG Instant Nudeln Hot Chicken Cream Carbonara 140g", "product_url": "https://mao-mao.de/products/samyang-instant-nudeln-hot-chicken-cream-carbonara-1...", "product_type": "NOTONSALE", "vendor": "Samyang", "total_revenue": 4043.070000000009},
 {"p.product_id": "8555621810444", "product_title": "SAMYANG Instant Nudeln Hot Chicken Quattro 4-Käse 145g", "product_url": "https://mao-mao.de/products/samyang-instant-nudeln-hot-chicken-quattro-cheese-14...", "product_type": "NOTONSALE", "vendor": "Samyang", "total_revenue": 2880.9900000000043},
 {"p.product_id": "8384273809676", "product_title": "SAMYANG Instant Nudeln Hot Chicken Käse 140g", "product_url": "https://mao-mao.de/products/samyang-hot-chicken-cheese-flavor-ramen-140g", "product_type": "NOTONSALE", "vendor": "Samyang", "total_revenue": 2394.6299999999983},
 {"p.product_id": "11547050574092", "product_title": "YOUNG POONG YOPOKKI Tteokbokki Käse 120g", "product_url": "https://mao-mao.de/products/young-poong-yopokki-tteokbokki-kase-120g", "product_type": "Instant Noodles", "vendor": "Young Poong", "total_revenue": 2308.87},
 {"p.product_id": "8454565396748", "product_title": "Gebühr Kühltasche Kühlware / Fee Cooling Bag & cold products", "product_url": "https://mao-mao.de/products/product-fee", "product_type": "fee", "vendor": "MAOMAO", "total_revenue": 2277.3999999999955},
 {"p.product_id": "9701478662412", "product_title": "SAMYANG Instant Nudeln Buldak Korean Frittiertes Hähnchen süß & scharf 140g", "product_url": "https://mao-mao.de/products/samyang-instant-nudeln-hot-chicken-frittiertes-huhnc...", "product_type": "NOTONSALE", "vendor": "Samyang", "total_revenue": 2186.9700000000016},
 {"p.product_id": "8708834394380", "product_title": "Mystery box - Korea Style", "product_url": "https://mao-mao.de/products/mystery-box-korea-style", "product_type": "", "vendor": "MAOMAO", "total_revenue": 1687.590000000001},
 {"p.product_id": "11524211900684", "product_title": "SAMYANG Tangle Bulgogi Alfredo 108g", "product_url": "https://mao-mao.de/products/samyang-tangle-bulgogi-alfredo-108g", "product_type": "NOTONSALE", "vendor": "Samyang", "total_revenue": 1684.0700000000013},
 {"p.product_id": "8447277990156", "product_title": "NONG SHIM Instant Nudeln Chapagetti 140g (1+1 Aktion, Gratisprodukte müssen selb...", "product_url": "https://mao-mao.de/products/nong-shim-chapaghetti-instant-nudeln-140g", "product_type": "Instant Noodles", "vendor": "Nong Shim", "total_revenue": 1600.4299999999992}
]

# Create DataFrame
df = pd.DataFrame(data)

# Sort by total revenue
df_sorted = df.sort_values(by='total_revenue', ascending=False).head(10)

# Plotting
plt.figure(figsize=(10, 6))
plt.barh(df_sorted['product_title'], df_sorted['total_revenue'], color='skyblue')
plt.xlabel('Total Revenue')
plt.title('Top 10 Best-Selling Products by Revenue')
plt.gca().invert_yaxis()

# Save plot
# output_dir already defined above # Change this to your desired output directory
plt.savefig(os.path.join(output_dir, 'top_10_best_selling_products.png'))
plt.show()

# Save enriched data to CSV
df_sorted.to_csv(os.path.join(output_dir, 'top_10_best_selling_products.csv'), index=False)

print("Analysis completed successfully!")
