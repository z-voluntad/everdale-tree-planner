"""One-time migration from local evidence. No machine paths are written to output data."""
import json, pathlib
base=pathlib.Path(__file__).resolve().parents[1]
source=base.parent/'everdale-layout-editor-2026-11-03'
out=base/'src'/'data';out.mkdir(parents=True,exist_ok=True)
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
write=lambda p,d:p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
nodes=read(source/'everdale-layout-70x70.json')['nodes']
kinds={'汤锅':'soup','石头':'stone','黏土':'clay','树木':'forest'}
fixed=[{**{k:n[k] for k in ['x','y','w','h']},'id':f'fixed-{i+1}','kind':kinds[n['label']]} for i,n in enumerate(nodes)]
write(out/'fixed-nodes.json',fixed)
for name,file in [('one','tree-layout.json'),('two','plan-two.json')]:
    raw=read(source/'src'/file)
    groups=[{k:g[k] for k in ['id','x','y','w','h']} for g in raw['groups']]
    write(out/f'layout-{name}.json',{'id':f'preset-{name}','groups':groups,'cells':[],'reference':name})
    if name=='two':
        write(out/'reference-two.json',[{k:c[k] for k in ['x','y','color']} for c in raw.get('referenceCells',[])])
mask=read(base.parent/'everdale-map-2026-11-03'/'output'/'tree-boundary'/'tree-boundary-data.json')['ordinaryBuildMask']
assert len(mask)==70 and all(len(r)==70 for r in mask)
assert sum(r.count('.') for r in mask)==2600
write(out/'build-area.json',mask)
print('Imported 7 fixed nodes, two outer-ring layouts and the 2600-tile reference mask.')
