import sys
path = r"d:\new\WinAi_SeeuNextLift\src\features\director\components\CrudFeatures.tsx"
out = r"d:\new\WinAi_SeeuNextLift\debug_out.txt"

with open(path, "rb") as f:
    c = f.read()

with open(out, "w", encoding='utf-8') as f:
    f.write(f"Size: {len(c)}\n")
    try:
        text = c.decode('utf-8')
        f.write("Valid UTF-8")
    except Exception as e:
        f.write(str(e))
