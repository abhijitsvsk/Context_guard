import os
import re
import zlib
import datetime

print(f"=== SCRIPT EXECUTION TIMESTAMP: {datetime.datetime.now().isoformat()} ===\n")

conv_dir = r"os.path.expanduser('~')\.gemini\antigravity\conversations"
targets = [
    "71b20f30-5940-435a-b7d1-9512ae6f373d.pb",
    "457819bf-3018-4ced-bf02-f00de24c159a.pb"
]

print("--- 1. STRING BYTES / TOTAL SIZE MEASUREMENTS ---")
for name in targets:
    p = os.path.join(conv_dir, name)
    data = open(p, "rb").read()
    # ASCII printable strings of length >= 3
    strings = re.findall(b"[\x20-\x7e]{3,}", data)
    str_len = sum(len(s) for s in strings)
    pct = (str_len / len(data)) * 100
    print(f"File: {name}")
    print(f"  Total file size : {len(data)} bytes")
    print(f"  Extracted string: {str_len} bytes")
    print(f"  String ratio    : {pct:.2f}%\n")

print("--- 2. ZLIB / GZIP DECOMPRESSION ATTEMPTS ---")
test_file = os.path.join(conv_dir, "71b20f30-5940-435a-b7d1-9512ae6f373d.pb")
test_data = open(test_file, "rb").read()

wbits_modes = {
    "zlib (wbits=15)": 15,
    "raw deflate (wbits=-15)": -15,
    "gzip (wbits=31)": 31,
    "auto-detect (wbits=47)": 47
}

for desc, wb in wbits_modes.items():
    try:
        decomp = zlib.decompress(test_data, wb)
        print(f"  {desc:<25}: SUCCESS (Decompressed size: {len(decomp)} bytes)")
    except Exception as e:
        print(f"  {desc:<25}: FAILED -> {type(e).__name__}: {e}")
