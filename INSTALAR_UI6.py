from pathlib import Path
import re,shutil,datetime,json
root=Path(__file__).resolve().parent
repo=Path.cwd()
(repo/'js').mkdir(exist_ok=True);(repo/'css').mkdir(exist_ok=True)
shutil.copy2(root/'js'/'47-noventia-ui6.js',repo/'js'/'47-noventia-ui6.js')
shutil.copy2(root/'css'/'noventia-ui6.css',repo/'css'/'noventia-ui6.css')
p=repo/'index.html';s=p.read_text(encoding='utf-8')
v=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
css=f'<link rel="stylesheet" href="css/noventia-ui6.css?v={v}">'
js=f'<script src="js/47-noventia-ui6.js?v={v}"></script>'
if 'noventia-ui6.css' not in s:s=s.replace('</head>',css+'\n</head>',1)
else:s=re.sub(r'href="css/noventia-ui6.css\?v=[^"]+"',f'href="css/noventia-ui6.css?v={v}"',s)
if '47-noventia-ui6.js' not in s:s=s.replace('</body>',js+'\n</body>',1)
else:s=re.sub(r'src="js/47-noventia-ui6.js\?v=[^"]+"',f'src="js/47-noventia-ui6.js?v={v}"',s)
p.write_text(s,encoding='utf-8')
vp=repo/'version.json'
if vp.exists():vp.write_text(json.dumps({'v':v},separators=(',',':'))+'\n',encoding='utf-8')
print('NOVENTIA UI6 instalada. Version:',v)
