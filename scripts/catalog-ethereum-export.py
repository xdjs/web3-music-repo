"""Export Ethereum royalty discovery identities only; NEVER export floating-point money.
Usage: python scripts/catalog-ethereum-export.py SNAPSHOT_PUBLIC_DIRECTORY
"""
import json, math, sys
from pathlib import Path
import duckdb
p = Path(sys.argv[1]); c = duckdb.connect()
def rows(table):
 q=c.sql('select * from read_parquet(?)', params=[str(p / (table+'.parquet'))])
 return [dict(zip(q.columns,row)) for row in q.fetchall()]
def exact(value):
 if isinstance(value,float):
  if not math.isfinite(value) or not value.is_integer() or abs(value)>2**53-1:raise ValueError('Unsafe numeric identity')
  value=int(value)
 if isinstance(value,int) and value>=0:return str(value)
 raise ValueError('Unexpected numeric identity')
known={(r['token_contract'].lower(),r['token_id']) for r in rows('token')}
source=rows('royalty_payout_event'); candidates=[]; skipped=0
for r in source:
 try:token=exact(r['token_id']);block=exact(r['block_number'])
 except ValueError:skipped+=1;continue
 if (r['token_contract'].lower(),token) not in known:continue
 candidates.append({'sourceEventId':r['id'],'chainId':1,'contract':r['token_contract'].lower(),'tokenId':token,'recipient':r['recipient'].lower(),'transactionHash':r['transaction_hash'].lower(),'blockNumber':block,'timestamp':r['timestamp'].isoformat()})
candidates.sort(key=lambda r:(int(r['blockNumber']),r['sourceEventId']), reverse=True)
out={'source':'https://github.com/catalogworks/catalog-squidward-data','snapshotDate':'2026-03-09','table':'royalty_payout_event','sourceRows':len(source),'unsafeIdentityRowsSkipped':skipped,'matchedCatalogRows':len(candidates),'scope':'Discovery identities only. Monetary FLOAT values deliberately excluded. Candidate recipient is not automatically the artist.','candidates':candidates}
Path('data/catalog/ethereum-revenue-candidates.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:v for k,v in out.items() if k!='candidates'},indent=2))
