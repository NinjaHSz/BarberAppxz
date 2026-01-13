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

# Debug: Print headers for the first day block
print("Debugging row 13/14 columns for the first block:")
for c in range(20):
    val13 = parser.grid.get((12, c), '')
    val14 = parser.grid.get((13, c), '')
    print(f"Col {c}: Row13='{val13}', Row14='{val14}'")

# Identify actual starting columns for dates
dates = {}
for c in range(1000):
    val = parser.grid.get((5, c), '') # Row 6 contains dates
    if ':' in val and ('/01/2026' in val or '/01/26' in val):
        match = re.search(r'(\d{2}/\d{2}/\d{4})', val)
        if match:
            d_str = match.group(1)
            # Only record the FIRST column index for this date
            if d_str not in dates.values() or c < min([k for k,v in dates.items() if v == d_str]):
                # Remove any existing (larger) indices for this date
                to_del = [k for k,v in dates.items() if v == d_str]
                for k in to_del: del dates[k]
                dates[c] = d_str

sorted_start_cols = sorted(dates.keys())
print(f"Unique days found at columns: {sorted_start_cols}")

import_data = []
for start_col in sorted_start_cols:
    date_str = dates[start_col]
    d, m, y = date_str.split('/')
    iso_date = f'{y}-{m}-{d}'
    
    day_num = int(d)
    if day_num < 8 or day_num > 31:
        continue

    print(f"Processing {date_str} at col {start_col}")

    # The data rows start where the 'Horário' is NO LONGER there?
    # No, they start at row 15 (based on the previous view_file showing row 15 as empty headers and 16 as data)
    for r in range(15, 250):
        # We need to find the correct relative offsets
        # Based on the debug output we will get soon, I'll adjust these
        # But let's try a dynamic search for the data within the block
        
        # In Row 16, Col 0 is 7:00 for Date 1.
        # Wait, if Date 1 starts at col X, let's find the 'Horário' cell in Row 14 relative to X.
        
        # From HTML: 
        # Row 6 has Date 1 at Col 2? Col 2-5. 
        # Wait, my previous code said cols 9,10,11,12.
        
        # Let's adjust based on the debug output.
        pass
