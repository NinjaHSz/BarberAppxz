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
        if tag == 'tr': self.curr_col = 0
        elif tag == 'td':
            self.in_td = True
            self.cell_content = ''
            attrs_dict = dict(attrs)
            self.rowspan = int(attrs_dict.get('rowspan', 1))
            self.colspan = int(attrs_dict.get('colspan', 1))
            while (self.curr_row, self.curr_col) in self.grid: self.curr_col += 1

    def handle_endtag(self, tag):
        if tag == 'td':
            content = self.cell_content.strip()
            for r in range(self.rowspan):
                for c in range(self.colspan): self.grid[(self.curr_row + r, self.curr_col + c)] = content
            self.curr_col += self.colspan
            self.in_td = False
        elif tag == 'tr': self.curr_row += 1

    def handle_data(self, data):
        if self.in_td: self.cell_content += data

parser = SheetParser()
html_path = r'c:\Users\jluca\Downloads\My Apps\BarberApp\assets\DataBase\JANEIRO 26.html'
with open(html_path, 'r', encoding='utf-8') as f:
    parser.feed(f.read())

# Day 13 is at column 56
print('--- Day 13 (col 56) Raw Data ---')
for r in range(16, 55): # Row 49 is near end
    time = parser.grid.get((r, 56), '')
    client = parser.grid.get((r, 57), '')
    service = parser.grid.get((r, 61), '') # Procedimentos col index? Let's check
    print(f'R{r}: Time=\"{time}\", Client=\"{client}\", Service=\"{service}\"')
