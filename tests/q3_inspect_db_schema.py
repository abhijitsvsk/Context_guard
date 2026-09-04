import sqlite3
import os

conv = r"os.path.expanduser('~')\.gemini\antigravity\conversations"
sid = "abe85271-ee69-4a49-81d6-e6c6fb9396df"
db_path = os.path.join(conv, f"{sid}.db")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Examine schema of all tables
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table';")
for s in cursor.fetchall():
    print(s[0])
    print("-" * 50)
