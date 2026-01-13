import sys
import re
from html.parser import HTMLParser
import os

class SheetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.grid = {}
        self.curr_row = 0
        self.curr_col = 0
        self.in_td = False
        self.cell_content = ''
        self.rowspan = 1
        self.colspan = 1

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.curr_col = 0
        elif tag == 'td':
            self.in_td = True
            self.cell_content = ''
            attrs_dict = dict(attrs)
            self.rowspan = int(attrs_dict.get('rowspan', 1))
            self.colspan = int(attrs_dict.get('colspan', 1))
            
            while (self.curr_row, self.curr_col) in self.grid:
                self.curr_col += 1

    def handle_endtag(self, tag):
        if tag == 'td':
            content = self.cell_content.strip()
            for r in range(self.rowspan):
                for c in range(self.colspan):
                    self.grid[(self.curr_row + r, self.curr_col + c)] = content
            self.curr_col += self.colspan
            self.in_td = False
        elif tag == 'tr':
            self.curr_row += 1

    def handle_data(self, data):
        if self.in_td:
            self.cell_content += data

parser = SheetParser()
html_path = r'c:\Users\jluca\Downloads\My Apps\BarberApp\assets\DataBase\JANEIRO 26.html'
if not os.path.exists(html_path):
    print(f"File not found: {html_path}")
    sys.exit(1)

with open(html_path, 'r', encoding='utf-8') as f:
    parser.feed(f.read())

# Identify days and their columns
dates = {}
# Scan first 50 rows for date headers
for r in range(10):
    for c in range(500):
        val = parser.grid.get((r, c), '')
        if ':' in val and ('/01/2026' in val or '/01/26' in val):
            match = re.search(r'(\d{2}/\d{2}/\d{4})', val)
            if match:
                dates[c] = match.group(1)

# Sort date columns
sorted_cols = sorted(dates.keys())
print(f"Found dates at columns: {sorted_cols}")

import_data = []
for start_col in sorted_cols:
    date_str = dates[start_col]
    d, m, y = date_str.split('/')
    iso_date = f'{y}-{m}-{d}'
    
    # Check if daytime is 08 to 31
    day_num = int(d)
    if day_num < 8 or day_num > 31:
        continue

    # Data rows usually start after headers (around row 15)
    for r in range(15, 200): # Scan up to 200 rows to be sure
        time = parser.grid.get((r, start_col), '')
        if not time or ':' not in time: 
            continue
        
        # Cliente is colspan 4, so col indices are +1 to +4
        client = parser.grid.get((r, start_col + 1), '')
        # Procedimentos colspan 2, so +5, +6
        service = parser.grid.get((r, start_col + 5), '')
        # Valor colspan 2, so +7, +8
        value_raw = parser.grid.get((r, start_col + 7), '')
        # Pagamento colspan 4, so +9 to +12
        payment = parser.grid.get((r, start_col + 9), '')
        
        # Validation
        if not client or client in ['---', '', 'CLIENTE']: continue
        if service in ['---', '', 'PROCEDIMENTOS']: continue
        if 'NÃO VEIO' in service.upper() or 'NÃO VEIO' in client.upper(): continue

        # Clean value
        value = 0.0
        if value_raw:
            value_clean = re.sub(r'[^\d,.]', '', value_raw).replace(',', '.')
            try:
                if value_clean:
                    value = float(value_clean)
            except:
                value = 0.0
        
        import_data.append((iso_date, time, client, service, value, payment))

if not import_data:
    print("No data found to import.")
    sys.exit(0)

# Generate SQL
sql = 'INSERT INTO agendamentos (data, horario, cliente, procedimento, valor, forma_pagamento) VALUES\n'
entries = []
for d in import_data:
    cliente_esc = d[2].replace("'", "''")
    servico_esc = d[3].replace("'", "''")
    time_esc = d[1].strip()
    # Normalize time HH:MM
    if len(time_esc.split(':')[0]) == 1:
        time_esc = '0' + time_esc
    
    row = f"('{d[0]}', '{time_esc}', '{cliente_esc}', '{servico_esc}', {d[4]}, '{d[5]}')"
    entries.append(row)

sql += ',\n'.join(entries) + ';'

output_path = r'c:\Users\jluca\Downloads\My Apps\BarberApp\assets\Outputs\import_appointments_jan_26.sql'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(sql)

print(f'Successfully imported {len(import_data)} records to {output_path}')
