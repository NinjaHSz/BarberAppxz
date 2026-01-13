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
with open(html_path, 'r', encoding='utf-8') as f:
    parser.feed(f.read())

print(f"Total rows scanned: {parser.curr_row}")

# Gather all unique dates and their block starts
date_blocks = {} # start_col -> iso_date
for r in range(20): # Date headers are near the top
    for c in range(1000):
        val = parser.grid.get((r, c), '')
        if ':' in val and '/01/' in val:
            match = re.search(r'(\d{2}/\d{2}/\d{2,4})', val)
            if match:
                date_str = match.group(1)
                # Normalize to DD/MM/YYYY
                parts = date_str.split('/')
                if len(parts[2]) == 2: parts[2] = '20' + parts[2]
                iso_date = f"{parts[2]}-{parts[1]}-{parts[0]}"
                
                # Logic: The block starts 9 columns BEFORE the Payment Method column where the date header is centered
                # But wait, some dates might be at different offsets? 
                # Let's check headers in row 14 for 'Horário' near this column
                found_start = -1
                for offset in range(-13, 1):
                    if parser.grid.get((14, c + offset), '').lower() == 'horário':
                        found_start = c + offset
                        break
                
                if found_start != -1:
                    date_blocks[found_start] = iso_date

sorted_starts = sorted(date_blocks.keys())
print(f"Found {len(date_blocks)} date blocks.")

import_data = []
for start_col in sorted_starts:
    iso_date = date_blocks[start_col]
    day_num = int(iso_date.split('-')[2])
    
    if day_num < 8 or day_num > 31:
        continue

    print(f"Sampling {iso_date} at column {start_col}")
    
    for r in range(16, 500): # Scan many rows
        time = parser.grid.get((r, start_col), '')
        if not time or ':' not in time:
            # Check if there's any data in the rest of the row, maybe time is missing?
            # But usually time is the key. 
            continue
            
        client = parser.grid.get((r, start_col + 1), '')
        service = parser.grid.get((r, start_col + 5), '')
        value_raw = parser.grid.get((r, start_col + 7), '')
        payment = parser.grid.get((r, start_col + 9), '')

        if not client or client in ['---', '', 'CLIENTE']: continue
        if 'NÃO VEIO' in service.upper() or 'NÃO VEIO' in client.upper(): continue
        
        # Clean value
        value = 0.0
        if value_raw:
            value_clean = re.sub(r'[^\d,.-]', '', value_raw).replace(',', '.')
            try:
                if value_clean:
                    # Remove trailing dots if any
                    value_clean = value_clean.strip('.')
                    value = float(value_clean)
            except:
                value = 0.0

        # Normalize time HH:MM
        time_clean = time.strip()
        if len(time_clean.split(':')[0]) == 1:
            time_clean = '0' + time_clean
        if len(time_clean) > 5: # handle things like 07:00:00
            time_clean = time_clean[:5]

        import_data.append({
            'data': iso_date,
            'horario': time_clean,
            'cliente': client.replace("'", "''"),
            'procedimento': service.replace("'", "''"),
            'valor': value,
            'forma_pagamento': payment
        })

if not import_data:
    print("No records found.")
    sys.exit(0)

sql = "INSERT INTO agendamentos (data, horario, cliente, procedimento, valor, forma_pagamento) VALUES\n"
rows = []
for d in import_data:
    rows.append(f"('{d['data']}', '{d['horario']}', '{d['cliente']}', '{d['procedimento']}', {d['valor']}, '{d['forma_pagamento']}')")

sql += ",\n".join(rows) + ";"

output_path = r'c:\Users\jluca\Downloads\My Apps\BarberApp\assets\Outputs\import_appointments_full.sql'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(sql)

print(f"Successfully generated {len(import_data)} records in {output_path}")
