import os
import re

vue_dir = r'c:\Users\jfons\Documents\proyectos\XML_PROYECT\subir_xml_vue3\src'
overlay_files = []
key_index_files = []

for root, dirs, files in os.walk(vue_dir):
    for f in files:
        if f.endswith('.vue'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
                if '<VOverlay :model-value="isLoading"' in content:
                    overlay_files.append(os.path.relpath(path, vue_dir))
                if re.search(r':key=[\'"]index[\'"]', content):
                    key_index_files.append(os.path.relpath(path, vue_dir))

print('Overlay Files:', len(overlay_files))
print('Key Index Files:', len(key_index_files))
for f in key_index_files:
    print('  - ' + f)
