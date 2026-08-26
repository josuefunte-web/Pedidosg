from pathlib import Path
import re,json,datetime
root=Path(__file__).resolve().parent
version=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
p=root/"index.html"
s=p.read_text(encoding="utf-8")
s=re.sub(r"var LOCAL_VERSION='[^']+'",f"var LOCAL_VERSION='{version}'",s)
s=re.sub(r"window.APP_VERSION='[^']+'",f"window.APP_VERSION='{version}'",s)
s=re.sub(r"([?&]v=)[^\"'\n]+",rf"\g<1>{version}",s)
p.write_text(s,encoding="utf-8")
(root/"version.json").write_text(json.dumps({"v":version},separators=(",",":"))+"\n",encoding="utf-8")
print("Nueva versión:",version)
