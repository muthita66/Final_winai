import os

path = r"d:\new\WinAi_SeeuNextLift\src\features\director\components\CrudFeatures.tsx"
try:
    with open(path, "rb") as f:
        content = f.read()

    try:
        text = content.decode('utf-8')
        print("File is already valid UTF-8.")
    except UnicodeDecodeError as e:
        print(f"File contains invalid UTF-8 at position {e.start}.")
        context = content[max(0, e.start-20):e.start+20]
        print(f"Context (bytes): {context}")
        
        # Try tis-620
        try:
            text = content.decode('tis-620')
            print("Successfully decoded with tis-620.")
            with open(path, "w", encoding='utf-8') as f:
                f.write(text)
            print("Fixed by decoding as tis-620 and re-saving as utf-8")
        except:
            # Try cp874
            try:
                text = content.decode('cp874')
                print("Successfully decoded with cp874.")
                with open(path, "w", encoding='utf-8') as f:
                    f.write(text)
                print("Fixed by decoding as cp874 and re-saving as utf-8")
            except:
                text = content.decode('utf-8', errors='replace')
                with open(path, "w", encoding='utf-8') as f:
                    f.write(text)
                print("Fixed by replacing invalid bytes with '?'")

except Exception as e:
    print(f"Error: {e}")
