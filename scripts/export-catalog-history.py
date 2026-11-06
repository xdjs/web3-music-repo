"""Export public historical ownership inputs; never mix testnets into mainnet."""
import json, sys
from pathlib import Path
import duckdb

root = Path(sys.argv[1] if len(sys.argv) > 1 else "/private/tmp/catalog-recovery-data/squidward/20260309_140200/public")
connection = duckdb.connect()
def rows(name):
    relation = connection.sql("select * from read_parquet(?)", params=[str(root / (name + ".parquet"))])
    return [dict(zip(relation.columns, row)) for row in relation.fetchall()]

result = {"source": "https://github.com/catalogworks/catalog-squidward-data", "snapshotDate": "2026-03-09", "ethereumOwners": [], "baseTransfers": [], "basePurchases": []}
for row in rows("token"):
    result["ethereumOwners"].append({"contract": row["token_contract"].lower(), "tokenId": str(row["token_id"]), "address": row["owner"].lower() if row["owner"] else None})
for row in rows("cr_token_transfer_single"):
    if row["chain_id"] != 8453: continue
    if row["amount"] != int(row["amount"]) or abs(row["amount"]) > 2**53: raise ValueError("Unsafe transfer amount")
    result["baseTransfers"].append({"id": row["id"], "contract": row["contract_address"].lower(), "tokenId": str(row["token_id"]), "from": row["from"].lower(), "to": row["to"].lower(), "amount": str(int(row["amount"])), "block": int(row["transferred_at_block_number"]), "transaction": row["transferred_at_tx_hash"]})
for row in rows("cr_token_transfer_batch"):
    if row["chain_id"] == 8453: raise ValueError("Mainnet batch transfers require explicit decoding before claiming snapshot balances")
for row in rows("cr_token_purchased"):
    if row["chain_id"] != 8453: continue
    result["basePurchases"].append({"id": row["id"], "contract": row["contract_address"].lower(), "tokenId": str(row["token_id"]), "recipient": row["recipient"].lower(), "buyer": row["from"].lower(), "amount": str(int(row["amount"])), "transaction": row["purchased_at_tx_hash"], "timestamp": str(row["purchased_at_timestamp"]), "block": int(row["purchased_at_block_number"])})
Path("data/catalog/holder-history.json").write_text(json.dumps(result, indent=2))
print({k: len(v) for k,v in result.items() if isinstance(v,list)})
