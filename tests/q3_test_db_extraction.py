import sqlite3
import os
import re
import datetime

conv_dir = r"os.path.expanduser('~')\.gemini\antigravity\conversations"
brain_dir = r"os.path.expanduser('~')\.gemini\antigravity\brain"

test_sids = [
    "abe85271-ee69-4a49-81d6-e6c6fb9396df",
    "0dfcd89f-b50f-4829-ba88-824449b25316",
    "c427674e-7486-4388-8b86-f4c7135192e1"
]

print(f"=== SQLITE .DB CONTENT EXTRACTION AUDIT ({datetime.datetime.now().isoformat()}) ===\n")

for sid in test_sids:
    db_path = os.path.join(conv_dir, f"{sid}.db")
    if not os.path.exists(db_path):
        continue
    
    file_size = os.path.getsize(db_path)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Total payload size
    cursor.execute("SELECT sum(length(step_payload)) FROM steps")
    total_payload_bytes = cursor.fetchone()[0] or 0
    
    # 2. Extract UTF-8 strings from payloads
    cursor.execute("SELECT step_payload FROM steps WHERE step_payload IS NOT NULL")
    rows = cursor.fetchall()
    
    extracted_text_bytes = 0
    for (payload,) in rows:
        # Match printable text sequences >= 4 characters
        matches = re.findall(b"[\x20-\x7e\n\r\t]{4,}", payload)
        extracted_text_bytes += sum(len(m) for m in matches)
        
    # Compare with transcript.jsonl if present
    jsonl_path = os.path.join(brain_dir, sid, ".system_generated", "logs", "transcript.jsonl")
    jsonl_bytes = os.path.getsize(jsonl_path) if os.path.exists(jsonl_path) else 0
    
    print(f"SESSION ID: {sid}")
    print(f"  DB File Size       : {file_size:,} B")
    print(f"  Total Payload Blobs: {total_payload_bytes:,} B")
    print(f"  Extracted Text     : {extracted_text_bytes:,} B")
    print(f"  transcript.jsonl   : {jsonl_bytes:,} B")
    if jsonl_bytes > 0:
        print(f"  Text / JSONL Ratio : {(extracted_text_bytes / jsonl_bytes) * 100:.1f}%")
        print(f"  DB File / JSONL    : {(file_size / jsonl_bytes):.2f}x file size inflation")
    print()
