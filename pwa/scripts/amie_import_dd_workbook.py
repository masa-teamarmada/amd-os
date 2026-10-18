"""Read the validated DD workbook into lossless model data and reader-facing blocks."""
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
from collections import Counter
import argparse, json, re, hashlib, gzip, posixpath, shutil, sys

S='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
D='{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}'
A='{http://schemas.openxmlformats.org/drawingml/2006/main}'
C='{http://schemas.openxmlformats.org/drawingml/2006/chart}'

def cn(s):
    n=0
    for c in s:n=n*26+ord(c)-64
    return n
def xy(s):
    m=re.fullmatch(r'\$?([A-Z]+)\$?(\d+)',s);return cn(m[1]),int(m[2])
def resolve(p,t):return t.lstrip('/') if t.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(p),t))
def rels(data,p):
    key=posixpath.join(posixpath.dirname(p),'_rels',posixpath.basename(p)+'.rels')
    return {x.get('Id'):resolve(p,x.get('Target')) for x in E.fromstring(data[key]) if x.get('TargetMode')!='External'} if key in data else {}
def texts(el):return ''.join(el.itertext()) if el is not None else ''

CHAPTERS=[
 ('事業計画','business-plan','事業と成長'),('エクイティストーリー','equity-story','事業と成長'),
 ('資本政策表','capital-plan','資金と採算'),('損益・資金繰','financial-plan','資金と採算'),('生産・拠点計画','production-plan','事業と成長'),
 ('会社概要','company','会社と体制'),('廃液処理事業','effluent-business','3つの事業'),('金属資源化事業','metal-business','3つの事業'),('バイオ燃料事業','fuel-business','3つの事業'),
 ('UE','unit-economics','資金と採算'),('シアノ生産コスト','cyanobacteria-cost','資金と採算'),('リアクター処理コスト','reactor-cost','資金と採算'),('金属回収コスト','metal-cost','資金と採算'),('FAME生産コスト','fame-cost','資金と採算'),
 ('市場調査','market','市場と顧客'),('競合比較','competition','市場と顧客'),('顧客・関係先','partners','市場と顧客'),('ビジネスモデル','business-model','事業と成長'),('協業計画','collaboration','事業と成長'),('SIER','sier','事業と成長'),
 ('技術説明','technology','技術と実証'),('製品資料','product','技術と実証'),('PoCリスト','poc','技術と実証'),('GAPファンド','gap-fund','技術と実証'),('計画詳細','execution-plan','事業と成長'),
 ('組織図','organization','会社と体制'),('職務分掌','responsibilities','会社と体制'),('経営陣略歴','biographies','会社と体制'),('知財・契約','ip-contracts','権利と規制'),('法規制','regulations','権利と規制'),
 ('共通前提','assumptions','計算と付属資料'),('販売・費用前提','commercial-assumptions','計算と付属資料'),('設備費用内訳','equipment-costs','計算と付属資料'),('資金繰内訳','cash-details','計算と付属資料'),('燃料開発費','fuel-development','計算と付属資料'),('補完事項','supplement','計算と付属資料'),('開示資料対応表','disclosure-index','計算と付属資料'),('資料一覧','source-index','計算と付属資料')]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('source');parser.add_argument('output');args=parser.parse_args()
    source=Path(args.source);out=Path(args.output);out.mkdir(parents=True,exist_ok=True);(out/'assets').mkdir(exist_ok=True)
    raw=source.read_bytes();sha=hashlib.sha256(raw).hexdigest()
    assert sha=='f94077ac4d35c352999f1a9743f9ccd58128f18d62a2004f91e6dcec57b9e2cb'
    with ZipFile(source) as z:data={n:z.read(n) for n in z.namelist()}
    wb=E.fromstring(data['xl/workbook.xml']);wr=rels(data,'xl/workbook.xml');sm={x.get('name'):wr[x.get(R+'id')] for x in wb.find(S+'sheets')}
    print_areas={}
    for defined in wb.findall(S+'definedNames/'+S+'definedName'):
        if defined.get('name')!='_xlnm.Print_Area':continue
        match=re.fullmatch(r"'?([^']+)'?!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)",defined.text or '')
        if match:print_areas[match[1]]=(cn(match[4]),int(match[5]))
    assert set(sm)=={x[0] for x in CHAPTERS}
    strings=E.fromstring(data['xl/sharedStrings.xml']) if 'xl/sharedStrings.xml' in data else []
    st=E.fromstring(data['xl/styles.xml']);fonts=st.find(S+'fonts');fills=st.find(S+'fills');xfs=st.find(S+'cellXfs')
    formats={int(x.get('numFmtId')):x.get('formatCode') for x in st.findall(S+'numFmts/'+S+'numFmt')}
    formats.update({9:'0%',10:'0.00%',14:'yyyy/mm/dd'})
    model={'version':1,'sourceSha256':sha,'sheets':{},'inputs':[]};chapters=[];assets={};all_text=[];input_keys=set()
    from openpyxl.formula.translate import Translator
    def cell_value(cell):
        t=cell.get('t');v=cell.findtext(S+'v')
        if t=='s':return texts(strings[int(v)])
        if t=='inlineStr':return texts(cell.find(S+'is'))
        if t in ('str','e'):return v
        if v is None:return None
        if t=='b':return v=='1'
        try:return float(v)
        except ValueError:return v
    def chart(path,row):
        root=E.fromstring(data[path]);plot=root.find('.//'+C+'plotArea');typ=next((E.QName(x).localname for x in plot if E.QName(x).localname.endswith('Chart')),'barChart') if plot is not None else 'barChart'
        series=[]
        for s in root.findall('.//'+C+'ser'):
            name=s.findtext('.//'+C+'tx//'+C+'v') or s.findtext('.//'+C+'tx/'+C+'v') or ''
            cat=s.find(C+'cat');val=s.find(C+'val')
            series.append({'name':name,'categories':[x.text or '' for x in cat.findall('.//'+C+'pt/'+C+'v')] if cat is not None else [],'values':[float(x.text or 0) for x in val.findall('.//'+C+'pt/'+C+'v')] if val is not None else [],'formula':val.findtext('.//'+C+'f') if val is not None else None})
        number_format=root.find('.//'+C+'valAx/'+C+'numFmt')
        return {'kind':'chart','row':row,'chartType':typ,'horizontal':root.find('.//'+C+'barDir') is not None and root.find('.//'+C+'barDir').get('val')=='bar','stacked':any(x.get('val') in ('stacked','percentStacked') for x in root.findall('.//'+C+'grouping')),'title':' '.join(x.text or '' for x in root.findall('.//'+C+'title//'+A+'t')),'numberFormat':number_format.get('formatCode','General') if number_format is not None else 'General','series':series}
    for order,(name,slug,group) in enumerate(CHAPTERS):
        path=sm[name];root=E.fromstring(data[path]);rr=rels(data,path);cells=root.findall(S+'sheetData/'+S+'row/'+S+'c');anchors={};entries={};rows=[];ranges=[]
        for cell in cells:
            f=cell.find(S+'f')
            if f is not None and f.get('t')=='shared' and f.text:anchors[f.get('si')]=(cell.get('r'),'='+f.text)
        for cell in cells:
            address=cell.get('r');v=cell_value(cell);f=cell.find(S+'f');formula=None
            if f is not None:
                if f.text:formula=f.text
                elif f.get('t')=='shared':
                    origin,form=anchors[f.get('si')];formula=Translator(form,origin=origin).translate_formula(address).lstrip('=')
                elif f.get('t')=='dataTable':ranges.append({'anchor':address,**dict(f.attrib)})
            if v is None and formula is None:continue
            xf=xfs[int(cell.get('s','0'))];font=fonts[int(xf.get('fontId','0'))];color=font.find(S+'color');rgb=(color.get('rgb','') if color is not None else '').upper()[-6:]
            fmt=formats.get(int(xf.get('numFmtId','0')),'General');entries[address]={'v':v,'f':formula,'format':fmt}
            blue=False
            if len(rgb)==6:
                red,green,blue_value=[int(rgb[i:i+2],16) for i in (0,2,4)]
                blue=blue_value>=120 and blue_value>green*1.15 and red<green
            numeric=isinstance(v,(int,float)) and not isinstance(v,bool)
            parameter_sheet=name in ('共通前提','販売・費用前提','シアノ生産コスト','リアクター処理コスト','金属回収コスト','FAME生産コスト','燃料開発費','設備費用内訳')
            if not formula and parameter_sheet and ((numeric and blue) or (name=='共通前提' and address.startswith('C') and numeric)):
                entries[address]['input']=True;input_keys.add(name+'!'+address)
        hidden_cols=set()
        for col in root.findall(S+'cols/'+S+'col'):
            if col.get('hidden') in ('1','true'):hidden_cols.update(range(int(col.get('min')),int(col.get('max'))+1))
        merges={m.get('ref').split(':')[0]:m.get('ref') for m in root.findall(S+'mergeCells/'+S+'mergeCell')}
        relkey=posixpath.join(posixpath.dirname(path),'_rels',posixpath.basename(path)+'.rels')
        external={x.get('Id'):x.get('Target') for x in E.fromstring(data[relkey]) if x.get('TargetMode')=='External'} if relkey in data else {}
        links={h.get('ref').split(':')[0]:h.get('location') or external.get(h.get(R+'id')) for h in root.findall(S+'hyperlinks/'+S+'hyperlink')}
        for row in root.findall(S+'sheetData/'+S+'row'):
            if row.get('hidden') in ('1','true'):continue
            values=[]
            for cell in row:
                address=cell.get('r');x,y=xy(address);entry=entries.get(address)
                if x in hidden_cols or not entry or entry['v'] in (None,''):continue
                if entry['format']==';;;':continue
                # The workbook's declared publication area separates the document from scenario helpers.
                limit_col,limit_row=print_areas.get(name,(16384,1048576))
                if x>limit_col or y>limit_row:continue
                xf=xfs[int(cell.get('s','0'))];font=fonts[int(xf.get('fontId','0'))];fill=fills[int(xf.get('fillId','0'))];fc=font.find(S+'color');fg=fill.find('.//'+S+'fgColor');font_rgb=(fc.get('rgb','') if fc is not None else '')[-6:].upper();fill_rgb=(fg.get('rgb','') if fg is not None else '')[-6:].upper()
                span=merges.get(address,address).split(':');right=xy(span[-1])[0]
                is_head=(font_rgb in ('FFFFFF','FFFFFFFF') and fill_rgb not in ('','FFFFFF','000000') and right-x>=3) or bool(re.match(r'^\d{2}[　 ]',str(entry['v'])))
                item={'address':address,'column':x,'span':right-x+1,'value':entry['v'],'format':entry['format'],'formula':bool(entry['f']),'heading':is_head}
                if address in links:item['link']=links[address]
                values.append(item)
                if isinstance(entry['v'],str):all_text.append(entry['v'])
                if entry.get('input'):
                    label=' '.join(str(z['value']) for z in values[:-1] if isinstance(z['value'],str))[-160:] or address
                    model['inputs'].append({'sheet':name,'address':address,'label':label,'value':entry['v'],'format':entry['format']})
            if values:rows.append({'row':int(row.get('r')),'cells':values})
        # Excel list selectors are editable inputs too, including the metal selector.
        for validation in root.findall(S+'dataValidations/'+S+'dataValidation'):
            if validation.get('type')!='list':continue
            formula=validation.findtext(S+'formula1','')
            options=[]
            if formula.startswith('"') and formula.endswith('"'):options=formula[1:-1].split(',')
            else:
                match=re.fullmatch(r"(?:'([^']+)'|([^!]+))!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)",formula)
                if match:
                    other=E.fromstring(data[sm[match[1] or match[2]]]);bounds=(cn(match[3]),int(match[4]),cn(match[5]),int(match[6]))
                    options=[str(cell_value(c)) for c in other.findall(S+'sheetData/'+S+'row/'+S+'c') if bounds[0]<=xy(c.get('r'))[0]<=bounds[2] and bounds[1]<=xy(c.get('r'))[1]<=bounds[3] and cell_value(c) not in (None,'')]
            for address in validation.get('sqref','').split():
                if ':' in address or address not in entries or not options:continue
                if not any(c['address']==address for row in rows for c in row['cells']):continue
                entry=entries[address]
                if entry['f'] or not isinstance(entry['v'],str):continue
                row=next((r for r in rows if r['row']==xy(address)[1]),None)
                label=next((str(c['value']) for c in row['cells'] if c['column']<xy(address)[0]),address) if row else address
                entry['input']=True
                model['inputs'].append({'sheet':name,'address':address,'label':label,'value':entry['v'],'format':entry['format'],'options':options})
        objects=[]
        for drawing in root.findall(S+'drawing'):
            dp=rr[drawing.get(R+'id')];dr=E.fromstring(data[dp]);drels=rels(data,dp)
            for anchor in dr:
                row=int(anchor.findtext(D+'from/'+D+'row','0'))+1
                image=anchor.find('.//'+A+'blip')
                if image is not None:
                    target=drels[image.get(R+'embed')];b=data[target];key=hashlib.sha256(b).hexdigest()+'.'+target.split('.')[-1]
                    mime={ 'png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','webp':'image/webp','svg':'image/svg+xml'}.get(key.split('.')[-1],'application/octet-stream')
                    if key not in assets:(out/'assets'/key).write_bytes(b);assets[key]={'key':key,'mime':mime,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)}
                    props=anchor.find('.//'+D+'cNvPr');objects.append({'kind':'image','row':row,'assetKey':key,'caption':props.get('descr','') if props is not None else ''})
                c=anchor.find('.//'+C+'chart')
                if c is not None:objects.append(chart(drels[c.get(R+'id')],row))
        for link in links.values():
            if isinstance(link,str) and link in rr:pass
        model['sheets'][name]={'path':path,'cells':entries,'dataTables':ranges,'merges':list(merges.values())}
        chapters.append({'slug':slug,'title':name,'group_label':group,'sort_order':order,'source_sheet':name,'body':{'version':1,'rows':rows,'objects':objects}})
    # Store every source cell, including hidden calculation cells; the reader gets visible rows.
    # The organization caption was added just below the workbook's original print area.
    organization=next(c for c in chapters if c['slug']=='organization');caption=model['sheets']['組織図']['cells'].get('B50')
    if caption:organization['body']['rows'].append({'row':50,'cells':[{'address':'B50','column':2,'span':37,'value':caption['v'],'format':'General','formula':False,'heading':False}]})
    payload={'version':1,'importRevision':'reader-v3','sourceSha256':sha,'sourceVersion':'v1.20','filename':source.name,'title':'SolvioraX｜投資検討資料','chapters':chapters,'assets':list(assets.values()),'counts':{'sheets':len(model['sheets']),'formulas':sum(bool(c['f']) for s in model['sheets'].values() for c in s['cells'].values()),'visibleRows':sum(len(x['body']['rows']) for x in chapters),'visibleCells':sum(len(r['cells']) for c in chapters for r in c['body']['rows']),'charts':sum(o['kind']=='chart' for c in chapters for o in c['body']['objects']),'imagePlacements':sum(o['kind']=='image' for c in chapters for o in c['body']['objects']),'uniqueImages':len(assets),'inputs':len(model['inputs'])}}
    (out/'manifest.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')))
    (out/'model.json.gz').write_bytes(gzip.compress(json.dumps(model,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
    shutil.copyfile(source,out/'source.xlsx')
    (out/'content-audit.json').write_text(json.dumps({'sourceSha256':sha,'counts':payload['counts'],'chapters':[{'title':c['title'],'rows':len(c['body']['rows']),'objects':len(c['body']['objects'])} for c in chapters]},ensure_ascii=False,indent=2))
    print(json.dumps(payload['counts'],ensure_ascii=False))

if __name__=='__main__':main()
