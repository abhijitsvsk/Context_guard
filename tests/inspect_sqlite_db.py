import sqlite3
import os

conv = r'os.path.expanduser('~')\.gemini\antigravity\conversations'
sid = 'abe85271-ee69-4a49-81d6-e6c6fb9396df'
db_path = os.path.join(conv, f'{sid}.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print('Tables in current session db:', tables)
for t in tables:
    tname = t[0]
    cursor.execute(f'SELECT count(*) FROM "{tname}"')
    cnt = cursor.fetchone()[0]
    cursor.execute(f'PRAGMA table_info("{tname}")')
    cols = [c[1] for c in cursor.fetchall()]
    print(f'Table: {tname} | Rows: {cnt} | Columns: {cols}')
