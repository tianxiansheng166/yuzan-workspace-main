from PIL import Image, ImageChops, ImageEnhance
from pathlib import Path
import numpy as np, json
base=Path(__file__).parent
ref=Image.open(base/'reference.png').convert('RGB')
cur=Image.open(base/'current.png').convert('RGB')
if cur.size!=ref.size: cur=cur.resize(ref.size,Image.Resampling.LANCZOS)
a=np.asarray(ref,dtype=np.float32);b=np.asarray(cur,dtype=np.float32)
mae=float(np.abs(a-b).mean());rmse=float(np.sqrt(((a-b)**2).mean()))
diff=ImageChops.difference(ref,cur)
diff=ImageEnhance.Contrast(diff).enhance(2.4)
diff.save(base/'diff.png')
report={'viewport':list(ref.size),'mae':round(mae,3),'rmse':round(rmse,3),'note':'Reference includes rasterized design text; implementation intentionally rebuilds dynamic UI with HTML/CSS/SVG.'}
(base/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
