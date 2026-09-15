"""生成 EnBox 应用图标：master PNG + macOS iconset"""
from PIL import Image, ImageDraw, ImageFont
import os

SIZE = 1024
HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.abspath(os.path.join(HERE, '..', 'assets'))

img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))

# 渐变背景（蓝→紫）
grad = Image.new('RGBA', (SIZE, SIZE))
gd = ImageDraw.Draw(grad)
top, bottom = (79, 140, 255), (138, 92, 255)
for y in range(SIZE):
    t = y / SIZE
    gd.line(
        [(0, y), (SIZE, y)],
        fill=(
            int(top[0] + (bottom[0] - top[0]) * t),
            int(top[1] + (bottom[1] - top[1]) * t),
            int(top[2] + (bottom[2] - top[2]) * t),
            255,
        ),
    )

# 圆角蒙版
mask = Image.new('L', (SIZE, SIZE), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=int(SIZE * 0.22), fill=255)
img.paste(grad, (0, 0), mask)

# 文字 En
d = ImageDraw.Draw(img)
font = None
for p in [
    '/System/Library/Fonts/SFNS.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
]:
    try:
        font = ImageFont.truetype(p, int(SIZE * 0.48))
        break
    except Exception:
        continue
if font is None:
    font = ImageFont.load_default()
text = 'En'
bbox = d.textbbox((0, 0), text, font=font)
w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
d.text(((SIZE - w) / 2 - bbox[0], (SIZE - h) / 2 - bbox[1]), text, font=font, fill=(255, 255, 255, 255))

os.makedirs(ASSETS, exist_ok=True)
img.save(os.path.join(ASSETS, 'icon.png'))

iconset = os.path.join(ASSETS, 'enbox.iconset')
os.makedirs(iconset, exist_ok=True)
for s in [16, 32, 128, 256, 512]:
    img.resize((s, s), Image.LANCZOS).save(os.path.join(iconset, f'icon_{s}x{s}.png'))
    img.resize((s * 2, s * 2), Image.LANCZOS).save(os.path.join(iconset, f'icon_{s}x{s}@2x.png'))
print('iconset 生成于', iconset)
