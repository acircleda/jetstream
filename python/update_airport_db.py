
import pandas as pd
import sqlite3
import os

# access data
airport_dv_url = "https://davidmegginson.github.io/ourairports-data/airports.csv"
df = pd.read_csv(airport_dv_url)

# remove data with missing ICAO codes
icao_df = df[df['icao_code'].notnull()]

# select relevant columns
data_clean = icao_df[['id', 'ident', 'name', 'latitude_deg', 'longitude_deg', 'iso_country', 'iso_region', 'municipality', 'icao_code', 'iata_code']]

# convert to sqlite
db_path = 'includes/airports.db'
if not os.path.exists(db_path):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
conn = sqlite3.connect(db_path)
data_clean.to_sql('airports', conn, if_exists='replace', index=False)
conn.close()