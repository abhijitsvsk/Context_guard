import os
import glob
import json

brain_dir = r"os.path.expanduser('~')\.gemini\antigravity\brain"
print(f"Scanning brain directory: {brain_dir}\n")

if not os.path.exists(brain_dir):
    print("Brain directory does not exist.")
    exit(1)

dirs = [d for d in os.listdir(brain_dir) if os.path.isdir(os.path.join(brain_dir, d))]

results = []
for d in dirs:
    full_path = os.path.join(brain_dir, d)
    t_jsonl = os.path.join(full_path, ".system_generated", "logs", "transcript.jsonl")
    t_full = os.path.join(full_path, ".system_generated", "logs", "transcript_full.jsonl")
    overview = os.path.join(full_path, "overview.txt")
    
    t_jsonl_size = os.path.getsize(t_jsonl) if os.path.exists(t_jsonl) else -1
    t_full_size = os.path.getsize(t_full) if os.path.exists(t_full) else -1
    overview_size = os.path.getsize(overview) if os.path.exists(overview) else -1
    
    # Check all files inside brain folder
    all_files = glob.glob(os.path.join(full_path, "**", "*"), recursive=True)
    file_count = len([f for f in all_files if os.path.isfile(f)])
    
    results.append({
        "id": d,
        "transcript_jsonl_bytes": t_jsonl_size,
        "transcript_full_bytes": t_full_size,
        "overview_bytes": overview_size,
        "total_files": file_count
    })

print(f"{'Folder ID':<38} | {'transcript.jsonl':<16} | {'transcript_full':<16} | {'overview.txt':<12} | {'Files'}")
print("-" * 105)
for r in results:
    t1 = f"{r['transcript_jsonl_bytes']} B" if r['transcript_jsonl_bytes'] >= 0 else "MISSING"
    t2 = f"{r['transcript_full_bytes']} B" if r['transcript_full_bytes'] >= 0 else "MISSING"
    ov = f"{r['overview_bytes']} B" if r['overview_bytes'] >= 0 else "MISSING"
    print(f"{r['id']:<38} | {t1:<16} | {t2:<16} | {ov:<12} | {r['total_files']}")
