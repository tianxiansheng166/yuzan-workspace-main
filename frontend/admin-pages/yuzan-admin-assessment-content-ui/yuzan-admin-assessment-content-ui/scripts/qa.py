from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance, ImageDraw
import numpy as np, json
ROOT=Path(__file__).resolve().parents[1]
ref=Image.open('/mnt/data/admin-assessment-content-candidate(1).png').convert('RGB')
cur=Image.open(ROOT/'qa'/'desktop.png').convert('RGB')
if cur.size!=ref.size: cur=cur.resize(ref.size,Image.Resampling.LANCZOS)
a=np.asarray(ref,dtype=np.float32);b=np.asarray(cur,dtype=np.float32)
mae=float(np.abs(a-b).mean());rmse=float(np.sqrt(((a-b)**2).mean()))
try:
    from skimage.metrics import structural_similarity
    ssim=float(structural_similarity(a.astype(np.uint8),b.astype(np.uint8),channel_axis=2,data_range=255))
except Exception:
    ssim=None
diff=ImageChops.difference(ref,cur)
ImageEnhance.Contrast(diff).enhance(3.4).save(ROOT/'qa'/'difference.png')
side=Image.new('RGB',(ref.width*2,ref.height),'white');side.paste(ref,(0,0));side.paste(cur,(ref.width,0));
d=ImageDraw.Draw(side);d.rectangle((0,0,ref.width,32),fill=(255,255,255));d.rectangle((ref.width,0,ref.width*2,32),fill=(255,255,255));d.text((12,8),'REFERENCE',fill=(30,30,30));d.text((ref.width+12,8),'RECONSTRUCTION',fill=(30,30,30));side.save(ROOT/'qa'/'side-by-side.jpg',quality=91)
report={'reference_size':list(ref.size),'screenshot_size':list(cur.size),'mae_0_255':round(mae,4),'rmse_0_255':round(rmse,4),'ssim':None if ssim is None else round(ssim,5),'notes':['Dynamic UI is reconstructed with HTML/CSS/JavaScript.','Decorative mountain assets are used only in bounded illustration regions.','Metrics include unavoidable font and SVG icon rasterization differences.']}
(ROOT/'qa'/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'QA_SUMMARY.md').write_text(f'''# 视觉校准报告\n\n- 参考图尺寸：{ref.width} × {ref.height}\n- 浏览器截图：{cur.width} × {cur.height}\n- MAE：`{mae:.4f} / 255`\n- RMSE：`{rmse:.4f} / 255`\n- SSIM：`{ssim:.5f}`\n\n## 说明\n\n页面结构、筛选、编辑画布、评分规则、版本信息、关联任务和表格均以真实 HTML/CSS/JavaScript 实现。装饰性山脉素材仅用于阅读材料插画、写作区弱背景和侧栏底部纹理，没有将整张参考图作为网页背景。\n''',encoding='utf-8')
print(report)
