"""Export mainnet metadata/payment inputs from Catalog's official Parquet snapshot.
Usage: python scripts/export-catalog-enrichment.py /path/to/squidward/20260309_140200/public
Requires duckdb. This is a read-only local export; no production DB is used.
"""
import json
import sys
from pathlib import Path
import duckdb

root = Path(sys.argv[1])
connection = duckdb.connect()
out = Path('data/catalog')
out.mkdir(parents=True, exist_ok=True)

def rows(name):
    q = connection.sql('select * from read_parquet(?) where chain_id=8453', params=[str(root / (name + '.parquet'))])
    return [dict(zip(q.columns, row)) for row in q.fetchall()]

def safe(row):
    result = {}
    for key, value in row.items():
        if isinstance(value, float):
            if not value.is_integer() or abs(value) > 2**53:
                raise ValueError('Unsafe numeric export: ' + key)
            result[key] = str(int(value))
        elif hasattr(value, 'isoformat'):
            result[key] = value.isoformat()
        else:
            result[key] = value
    return result

metadata = {}
for row in rows('cr_token'):
    if row['metadata']:
        metadata[row['id']] = {'source': row['token_uri'], 'metadata': json.loads(row['metadata']), 'snapshotDate': '2026-03-09'}
(out / 'original-metadata.json').write_text(json.dumps(metadata, indent=2))
(out / 'purchase-financial-inputs.json').write_text(json.dumps({'source': 'https://github.com/catalogworks/catalog-squidward-data', 'snapshotDate': '2026-03-09', 'events': [safe(row) for row in rows('cr_token_purchased')]}, indent=2))
(out / 'payment-config-history.json').write_text(json.dumps([safe(row) for row in rows('usdc_fixed_price_controller_mint_config_updated')], indent=2))
print('Mainnet Catalog inputs exported; metadata rows:', len(metadata))
