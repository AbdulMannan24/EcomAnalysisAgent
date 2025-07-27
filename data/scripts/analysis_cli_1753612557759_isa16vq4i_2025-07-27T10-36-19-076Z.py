
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
data_file = "/Users/abdulmannan/Desktop/Development/EcomAnalysisAgent/data/queries/query_cli_1753612557759_isa16vq4i_2025-07-27T10-36-08-888Z.json"
output_dir = "/Users/abdulmannan/Desktop/Development/EcomAnalysisAgent/data/analysis/session_cli_1753612557759_isa16vq4i_2025-07-27T10-36-19-076Z"
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
import os

# Sample data
data = [
 {"p.product_id": "11547050574092", "product_title": "YOUNG POONG YOPOKKI Tteokbokki Käse 120g", "v.inventory": 67, "total_units_sold": 1034},
 {"p.product_id": "11627220533516", "product_title": "NUR 1 CENT MEET SEOUL Ade Beutelgetränke Blaue Zitrone 230ml - 3 Stück Max pro B...", "v.inventory": 0, "total_units_sold": 820},
 {"p.product_id": "8392155267340", "product_title": "YUMEI scharfes Kohl-Kimchi 100g", "v.inventory": 55, "total_units_sold": 439},
 {"p.product_id": "8564968718604", "product_title": "WEILONG Latiao Scharf & Würzig 106g", "v.inventory": 11, "total_units_sold": 429},
 {"p.product_id": "11532515049740", "product_title": "SAMYANG Instant Nudel Schüssel Hot Chicken Carbonara 80g", "v.inventory": 82, "total_units_sold": 401},
 {"p.product_id": "8525395984652", "product_title": "YOUNG POONG YOPOKKI Tteokbokki Original Süß & Würzig 140g", "v.inventory": 72, "total_units_sold": 331},
 {"p.product_id": "11526585417996", "product_title": "CANTABILE Ade Beutelgetränke Blaubeer 230ml", "v.inventory": 76, "total_units_sold": 322},
 {"p.product_id": "8722684018956", "product_title": "BAIJIA A-Kuan Breite Nudeln mit Sesampaste 115g", "v.inventory": 0, "total_units_sold": 319},
 {"p.product_id": "8508704915724", "product_title": "MORINAGA Hi-Chew Grüner Apfel 55g", "v.inventory": 55, "total_units_sold": 305},
 {"p.product_id": "11469477052684", "product_title": "(KW) SAMYANG Hot Chicken Carbonara Gyoza Teigtasche 700g", "v.inventory": 57, "total_units_sold": 296}
]

# Convert data to DataFrame
df = pd.DataFrame(data)

# Filter products with inventory < 100 and units sold > 40
filtered_df = df[(df['v.inventory'] < 100) & (df['total_units_sold'] > 40)]

# Sort by total units sold in descending order
sorted_df = filtered_df.sort_values(by='total_units_sold', ascending=False)

# Select top 10 products
top_10_products = sorted_df.head(10)

# Output directory
# output_dir already defined above

# Save the result to a CSV file
output_file = os.path.join(output_dir, 'top_10_products_to_restock.csv')
top_10_products.to_csv(output_file, index=False)

print(f'Top 10 products to restock saved to {output_file}')

print("Analysis completed successfully!")
