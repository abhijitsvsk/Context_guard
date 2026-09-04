import os
import re
import datetime

conv_dir = r"os.path.expanduser('~')\.gemini\antigravity\conversations"
p_77 = os.path.join(conv_dir, "77c0eeee-dfdf-413e-920f-c5bcafb79a73.pb")
data = open(p_77, "rb").read()

print(f"=== 77c0eeee ANALYSIS ({datetime.datetime.now().isoformat()}) ===")
print(f"Total file size: {len(data)} bytes")

# Extract ASCII strings length >= 4
strings_4 = re.findall(b"[\x20-\x7e]{4,}", data)
len_4 = sum(len(s) for s in strings_4)
print(f"Strings (len >= 4): count={len(strings_4)}, total_bytes={len_4} ({len_4/len(data)*100:.2f}%)")

# Extract ASCII strings length >= 10
strings_10 = re.findall(b"[\x20-\x7e]{10,}", data)
len_10 = sum(len(s) for s in strings_10)
print(f"Strings (len >= 10): count={len(strings_10)}, total_bytes={len_10} ({len_10/len(data)*100:.2f}%)")

# Sample some of the strings >= 10
print("\nSample strings (len >= 10):")
for s in strings_10[:15]:
    print("  ", repr(s.decode('ascii', errors='ignore')))

# Token estimate comparison:
tokens_raw = round(len(data) / 2.70)
tokens_str4 = round(len_4 / 2.70)
tokens_str10 = round(len_10 / 2.70)

print(f"\nTOKEN ESTIMATE COMPARISONS:")
print(f"  Raw file size (3.04 MB / 2.70) : {tokens_raw:,} tokens ({(tokens_raw/1048576)*100:.1f}%)")
print(f"  Extracted strings >= 4         : {tokens_str4:,} tokens ({(tokens_str4/1048576)*100:.1f}%)")
print(f"  Extracted strings >= 10        : {tokens_str10:,} tokens ({(tokens_str10/1048576)*100:.1f}%)")
