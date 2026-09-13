#!/usr/bin/env python3
"""Create the overview sheet from native Composer renders (requires Pillow)."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
root=Path(__file__).resolve().parents[1]
im=Image.new('RGB',(1440,1200),'#100D18');d=ImageDraw.Draw(im)
font='/System/Library/Fonts/Supplemental/Arial.ttf';bold='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
def f(size,b=False):return ImageFont.truetype(bold if b else font,size)
d.text((66,44),'CRIMSON MUSIC',font=f(20,True),fill='#B18AFF')
d.text((66,84),'Četiri predloga ikonice',font=f(43,True),fill='#F3EEFF')
d.text((66,144),'Izvorni Icon Composer prikazi · iOS 27',font=f(19),fill='#A79AAF')
for i,(slug,title,subtitle) in enumerate([('01-ribbon','01  Ribbon','Nota sa presavijenim vrhom'),('02-riff','02  Riff','Ukošena, svedena polunota'),('03-resonance','03  Resonance','Crimson C i muzički ritam'),('04-sonata','04  Sonata','Dve note u kontrapunktu')]):
 x=66+(i%2)*672;y=202+(i//2)*479
 d.rounded_rectangle((x,y,x+636,y+445),radius=25,fill='#191323',outline='#2F233E',width=1)
 for mode,size,ix,iy in [('default',282,x+36,y+31),('dark',138,x+390,y+42),('mono',138,x+390,y+219)]:
  source=Image.open(root/'candidates'/slug/'previews'/f'{mode}.png').convert('RGBA').resize((size,size),Image.Resampling.LANCZOS)
  im.paste(source,(ix,iy),source)
  if mode!='default':d.text((ix+size/2,iy+size+10),'Dark' if mode=='dark' else 'Mono',font=f(15),fill='#B7ACBF',anchor='mt')
 d.text((x+36,y+342),title,font=f(27,True),fill='#F3EEFF')
 d.text((x+36,y+385),subtitle,font=f(17),fill='#B7ACBF')
d.text((66,1170),'Preporuka: 01 Ribbon · Svi predlozi su vektorski i mogu da se dorade.',font=f(19),fill='#B18AFF',anchor='ls')
im.save(root/'Crimson-icon-options.jpg',quality=95)
