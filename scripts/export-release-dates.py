"""Export historical creation dates, never recovery timestamps.
Usage: python scripts/export-release-dates.py SNAPSHOT_PUBLIC_DIRECTORY
Requires duckdb; also reads the checked-in Sound factory census.
"""
import json,sys
from pathlib import Path
from datetime import timezone
import duckdb
p=Path(sys.argv[1]);c=duckdb.connect()
source='https://github.com/catalogworks/catalog-squidward-data'
result={'scope':'Historical token/release-contract creation dates; not necessarily public release or first purchase dates','snapshotDate':'2026-03-09','tokens':{},'contracts':{}}
def rows(table):
 q=c.sql('select * from read_parquet(?)',params=[str(p/(table+'.parquet'))]);return [dict(zip(q.columns,x)) for x in q.fetchall()]
def add(chain,contract,token,date,table,tx):
 if not date:return
 if not isinstance(token,str) or not token.isdecimal():raise ValueError('Exact token ID string required')
 key=f'{chain}:{contract.lower()}:{token}'
 if key in result['tokens']:raise ValueError('Duplicate token date')
 result['tokens'][key]={'date':date.astimezone(timezone.utc).isoformat().replace('+00:00','Z'),'kind':'token-created','source':source,'sourceTable':table,'transaction':tx}
for r in rows('token'):add(1,r['token_contract'],r['token_id'],r['created_at_block_timestamp'],'token',r['created_at_tx_hash'])
for r in rows('cr_token'):
 if r['chain_id']==8453:add(8453,r['contract_address'],r['token_id'],r['created_at_timestamp'],'cr_token',r['created_at_tx_hash'])
for f in ['1-1.json','1-10.json','2-1.json','2-10.json']:
 data=json.loads((Path('data/census')/f).read_text())
 for r in data['collections']:
  if r['unit']!='release-contract' or not r.get('createdAt'):continue
  key=f"{data['chainId']}:{r['contract'].lower()}"
  value={'date':r['createdAt'],'kind':'release-contract-created','source':data['source'],'transaction':r['transaction'],'createdBlock':r['createdBlock'],'sourceFile':'data/census/'+f}
  if key in result['contracts'] and result['contracts'][key]['date']!=value['date']:raise ValueError('Conflicting contract date')
  result['contracts'][key]=value
result['counts']={'tokens':len(result['tokens']),'releaseContracts':len(result['contracts'])}
Path('data/release-dates.json').write_text(json.dumps(result,indent=2)+'\n');print(result['counts'])
