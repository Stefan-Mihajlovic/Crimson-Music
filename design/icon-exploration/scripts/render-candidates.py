#!/usr/bin/env python3
"""Export the editable candidates with Apple's renderer, not a browser mockup."""
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
XCODE = Path(subprocess.check_output(['xcode-select', '-p'], text=True).strip()).parent
ICTOOL = XCODE / 'Applications/Icon Composer.app/Contents/Executables/ictool'
if not ICTOOL.exists():
    ICTOOL = Path('/Applications/Icon Composer.app/Contents/Executables/ictool')

for document in sorted((ROOT/'candidates').glob('*/*.icon')):
    output = document.parent/'previews'
    output.mkdir(exist_ok=True)
    for name, rendition, generation in [('default','Default',27), ('dark','Dark',27), ('mono','TintedLight',27), ('default-26','Default',26)]:
        command = [str(ICTOOL), str(document), '--export-image', '--output-file', str(output/f'{name}.png'),
                   '--platform','iOS','--rendition',rendition,'--width','1024','--height','1024','--scale','1',
                   '--design-generation',str(generation)]
        subprocess.run(command,check=True,capture_output=True)
    archive = document.parent/f'{document.name}.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as zipped:
        for file in sorted(document.rglob('*')):
            if file.is_file():
                zipped.write(file, file.relative_to(document.parent))
    print(f'{document.stem}: Default / Dark / Mono / iOS 26 exported')
