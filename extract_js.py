import os

with open('original_index.html', 'r', encoding='utf-8') as f:
    content = f.read()

script_start = content.find('<script>') + len('<script>')
script_end = content.rfind('</script>')
script_content = content[script_start:script_end]

idx1 = script_content.find('1. EXAMPLE SNIPPETS')
idx2 = script_content.find('2. TINY, STRING-AWARE PARSER HELPERS')
idx4 = script_content.find('4. UI WIRING')

if idx1 != -1 and idx2 != -1 and idx4 != -1:
    start1 = script_content.rfind('/* ===', 0, idx1)
    start2 = script_content.rfind('/* ===', 0, idx2)
    start4 = script_content.rfind('/* ===', 0, idx4)
    
    examples_code = script_content[start1:start2].strip()
    simulator_code = script_content[start2:start4].strip()
    app_code = script_content[start4:].strip()
    
    if not os.path.exists('js'):
        os.makedirs('js')
        
    with open('js/examples.js', 'w', encoding='utf-8') as f:
        f.write(examples_code + '\n')
    with open('js/simulator.js', 'w', encoding='utf-8') as f:
        f.write(simulator_code + '\n')
    with open('js/app.js', 'w', encoding='utf-8') as f:
        f.write(app_code + '\n')
    print("Successfully extracted JS files")
else:
    print("Failed to find sections")
