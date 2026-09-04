import os
import glob

targets = [
    "d5c505c0-0ca8-42ba-9d65-ef409c31aff2",
    "2719ac48-8816-4001-9447-f7b82857b863"
]

brain_base = r"os.path.expanduser('~')\.gemini\antigravity\brain"

print("==========================================================================================")
print("                   NO DATA SESSIONS DIRECTORY & FILE INSPECTION                           ")
print("==========================================================================================\n")

for sid in targets:
    folder = os.path.join(brain_base, sid)
    print(f"FOLDER: {folder}")
    if not os.path.exists(folder):
        print("  --> FOLDER DOES NOT EXIST ON DISK!\n")
        continue
    
    # List all files recursively
    all_files = glob.glob(os.path.join(folder, "**", "*"), recursive=True)
    files_only = [f for f in all_files if os.path.isfile(f)]
    
    print(f"  --> Total Files Found: {len(files_only)}")
    for f in files_only:
        rel = os.path.relpath(f, folder)
        size = os.path.getsize(f)
        mtime = os.path.getmtime(f)
        print(f"      - {rel:<45} | Size: {size:<10} B | mtime: {mtime}")
    
    p_jsonl = os.path.join(folder, ".system_generated", "logs", "transcript.jsonl")
    p_full = os.path.join(folder, ".system_generated", "logs", "transcript_full.jsonl")
    p_ov = os.path.join(folder, "overview.txt")
    
    print(f"  Check Key Files:")
    print(f"    transcript.jsonl      : Exists={os.path.exists(p_jsonl)}, Size={os.path.getsize(p_jsonl) if os.path.exists(p_jsonl) else 0}")
    print(f"    transcript_full.jsonl : Exists={os.path.exists(p_full)}, Size={os.path.getsize(p_full) if os.path.exists(p_full) else 0}")
    print(f"    overview.txt          : Exists={os.path.exists(p_ov)}, Size={os.path.getsize(p_ov) if os.path.exists(p_ov) else 0}")
    print()
