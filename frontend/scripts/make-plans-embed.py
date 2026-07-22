import re
from pathlib import Path

frontend_dir = Path(__file__).resolve().parent.parent
src = frontend_dir / 'plans.css'
dst = frontend_dir / 'plans-embed.css'

global_selectors = {':root', '*', 'html', 'body', 'button', 'input', 'select', 'textarea', 'a', 'svg', 'button:focus-visible', 'input:focus-visible', 'select:focus-visible', 'textarea:focus-visible', 'a:focus-visible', '.sr-only'}

def add_prefix(selector):
    parts = [s.strip() for s in selector.split(',')]
    out = []
    for p in parts:
        if p in global_selectors or p.startswith(':root') or p.startswith('@'):
            out.append(p)
        else:
            out.append('.home-plans-embed ' + p)
    return ', '.join(out)

def process_block(block, prefix=''):
    result = []
    i = 0
    n = len(block)
    while i < n:
        while i < n and block[i] in ' \t\n\r':
            result.append(block[i])
            i += 1
        if i >= n:
            break
        start = i
        while i < n and block[i] != '{':
            i += 1
        selector = block[start:i].strip()
        if i >= n or block[i] != '{':
            break
        i += 1
        depth = 1
        content_start = i
        while i < n and depth > 0:
            if block[i] == '{':
                depth += 1
            elif block[i] == '}':
                depth -= 1
            i += 1
        content = block[content_start:i-1]
        if selector.startswith('@'):
            inner = process_block(content, prefix)
            result.append(selector + '{\n' + inner + '\n}\n')
        else:
            if selector in global_selectors:
                pass
            else:
                prefixed = prefix + add_prefix(selector)
                result.append(prefixed + '{\n' + content + '\n}\n')
    return ''.join(result)

with open(src, 'r', encoding='utf-8') as f:
    css = f.read()

out = process_block(css)
# Only remove truly global selectors that might have slipped through (safety net)
out = re.sub(r':root\s*\{[^}]*\}\s*', '', out, flags=re.DOTALL)
out = re.sub(r'\*\s*\{[^}]*\}\s*', '', out, flags=re.DOTALL)
out = re.sub(r'html\s*,\s*body\s*\{[^}]*\}\s*', '', out, flags=re.DOTALL)
out = re.sub(r'body\s*\{[^}]*\}\s*', '', out, flags=re.DOTALL)

header = '''/* Auto-generated embed scoped styles from plans.css */
.home-plans-embed {
  --red:#bf1017;
  --red2:#dc3b31;
  --green:#2d744c;
  --green-soft:#edf4ef;
  --gold:#bb7710;
  --gold2:#e49a28;
  --navy:#17263a;
  --paper:#f8f5ee;
  --ink:#242924;
  --muted:#6c726d;
  --line:#e4ddd3;
  --header:0px;
  --font:Inter,\"Noto Sans SC\",\"Microsoft YaHei\",\"PingFang SC\",Arial,sans-serif;
  font:14px/1.45 var(--font);
  color:var(--ink);
  box-sizing:border-box;
}
.home-plans-embed *, .home-plans-embed *::before, .home-plans-embed *::after {
  box-sizing:border-box;
}
.home-plans-embed button, .home-plans-embed input, .home-plans-embed select, .home-plans-embed textarea {
  font:inherit;
  color:inherit;
}
.home-plans-embed button { cursor:pointer; }
.home-plans-embed a { text-decoration:none; color:inherit; }
.home-plans-embed svg { display:block; }
'''

with open(dst, 'w', encoding='utf-8') as f:
    f.write(header)
    f.write(out)

print('plans-embed.css generated, length:', len(out))
