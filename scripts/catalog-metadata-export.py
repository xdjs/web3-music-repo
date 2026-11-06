"""Export original Ethereum Catalog JSON from the official read-only snapshot.

Usage: python scripts/catalog-metadata-export.py SNAPSHOT_PUBLIC_DIRECTORY
Requires duckdb. Writes a separate supplement, never the active recovery output.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path


def token_key(contract, token_id):
    if not isinstance(contract, str) or not re.fullmatch(r"0x[0-9a-fA-F]{40}", contract):
        raise ValueError("Invalid contract address")
    if not isinstance(token_id, str) or not re.fullmatch(r"0|[1-9][0-9]*", token_id):
        raise ValueError("Token ID must be an exact decimal string")
    return f"1-{contract.lower()}-{token_id}"


def export_records(tables, known_tokens, snapshot_date, hashes):
    result = {}
    for table in ("cnft", "media"):
        for row in tables[table]:
            key = token_key(row["token_contract"], row["token_id"])
            if key not in known_tokens:
                raise ValueError(f"Metadata token absent from Ethereum token census: {key}")
            if not row.get("metadata"):
                continue
            metadata = json.loads(row["metadata"])
            if not isinstance(metadata, dict):
                raise ValueError(f"Metadata must be an object: {key}")
            entry = {
                "source": row["metadata_uri"],
                "metadata": metadata,
                "snapshotDate": snapshot_date,
                "snapshotRepository": "https://github.com/catalogworks/catalog-squidward-data",
                "snapshotTable": table,
                "snapshotTableSha256": hashes[table],
            }
            if key in result:
                raise ValueError(f"Duplicate Ethereum token: {key}")
            result[key] = entry
    return dict(sorted(result.items()))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--snapshot-date", default="2026-03-09")
    parser.add_argument("--output", type=Path, default=Path("data/catalog/ethereum-original-metadata.json"))
    args = parser.parse_args()
    import duckdb
    connection = duckdb.connect()

    def rows(table):
        query = connection.sql("select * from read_parquet(?)", params=[str(args.snapshot / f"{table}.parquet")])
        return [dict(zip(query.columns, row)) for row in query.fetchall()]

    known = {token_key(r["token_contract"], r["token_id"]) for r in rows("token")}
    tables = {table: rows(table) for table in ("cnft", "media")}
    hashes = {table: hashlib.sha256((args.snapshot / f"{table}.parquet").read_bytes()).hexdigest() for table in tables}
    result = export_records(tables, known, args.snapshot_date, hashes)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"output": str(args.output), "knownEthereumTokens": len(known), "originalMetadata": len(result), "byTable": {t: sum(x["snapshotTable"] == t for x in result.values()) for t in tables}}, indent=2))


if __name__ == "__main__":
    main()
