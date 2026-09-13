#!/usr/bin/env python3
"""Editable vector concepts, packaged for Apple's Icon Composer.

All geometry is drawn for Crimson; there are no third-party logo paths.
Lighting, bevel and shadows belong to Icon Composer, not the SVG artwork.
"""
from pathlib import Path
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]

def svg(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">{body}</svg>\n'

def color_value(hex_color):
    r,g,b=[int(hex_color[i:i+2],16)/255 for i in (1,3,5)]
    return f'extended-srgb:{r:.5f},{g:.5f},{b:.5f},1.00000'

def create(slug, name, color, layers, material=0.12):
    base = ROOT / 'candidates' / slug
    document = base / f'Crimson-{name}.icon'
    assets = document / 'Assets'
    assets.mkdir(parents=True, exist_ok=True)
    layer_json=[]
    for label, artwork in layers:
        filename=f'{label}.svg'
        (assets / filename).write_text(svg(artwork))
        dark = '#965CFF'
        mono = '#FFFFFF'
        if label == 'layer-2':
            dark, mono = '#C6A7FF', '#C8C8C8'
        elif label == 'layer-3':
            dark, mono = '#6D28D9', '#858585'
        layer_json.append({'image-name': filename, 'name': label.replace('-', ' ').title(),
                           'position': {'scale': 1, 'translation-in-points': [0,0]},
                           'fill-specializations': [
                               {'appearance':'dark','value':{'solid': color_value(dark)}},
                               {'appearance':'tinted','value':{'solid': color_value(mono)}}]})
    r,g,b = [int(color[i:i+2],16)/255 for i in (1,3,5)]
    content={'features':['refractivity'], 'fill':{'automatic-gradient':f'extended-srgb:{r:.5f},{g:.5f},{b:.5f},1.00000'},
             'groups':[{'name': name, 'layers':layer_json, 'refractivity':{'depth':0.12,'enabled':True,'strength':0.5}, 'shadow':{'kind':'neutral','opacity':0.28}, 'translucency':{'enabled':True,'value':material}}],
             'supported-platforms':{'squares':'shared','circles':['watchOS']}}
    (document/'icon.json').write_text(json.dumps(content,indent=2)+'\n')
    (base/'previews').mkdir(exist_ok=True)
    return document

if __name__ == '__main__':
    for number, slug, name in [('01', 'ribbon', 'Ribbon'), ('04', 'sonata', 'Sonata')]:
        source = ROOT / 'sources' / f'{slug}.svg'
        root = ET.fromstring(source.read_text())
        items = list(root)
        if len(items) == 1 and items[0].tag.endswith('g'):
            group = items[0]
            items = []
            for child in list(group):
                layer = ET.Element('g', group.attrib)
                layer.append(child)
                items.append(layer)
        artwork = [(f'layer-{i+1}', ET.tostring(element, encoding='unicode').replace('ns0:', '').replace(':ns0', '')) for i, element in enumerate(items)]
        create(f'{number}-{slug}', name, '#571DB6' if slug == 'ribbon' else '#281146', list(reversed(artwork)), 0.2)

    create('02-riff','Riff','#6D28D9',[
        ('cut-note','<path fill="#F3EEFF" fill-rule="evenodd" d="M590 242 Q594 223 612 228 L684 246 Q702 250 697 269 L594 664 C578 727 538 769 484 788 C394 820 300 799 270 738 C232 657 286 565 370 536 C426 517 476 516 521 533 Z M493 639 C474 613 432 611 396 630 C360 649 346 681 364 704 C382 727 424 728 458 709 C492 690 510 664 493 639 Z"/>')],0.16)
    create('03-resonance','Resonance','#6D28D9',[
        ('rhythm','<rect x="646" y="394" width="80" height="236" rx="40" fill="#F3EEFF"/><rect x="756" y="453" width="72" height="118" rx="36" fill="#E2D3FF"/>'),
        ('crimson-c','<path fill="#F3EEFF" d="M662 293 L592 381 C558 354 518 341 474 341 C376 341 304 415 304 512 C304 609 376 683 474 683 C518 683 558 670 592 643 L662 731 C610 779 544 803 474 803 C310 803 188 677 188 512 C188 347 310 221 474 221 C544 221 610 245 662 293 Z"/>')],0.16)
