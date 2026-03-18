const fs = require('fs');

const filePath = 'd:\\new\\WinAi_SeeuNextLift\\src\\features\\director\\components\\CrudFeatures.tsx';

try {
  const buffer = fs.readFileSync(filePath);
  
  // Try to parse it as UTF-8
  const text = buffer.toString('utf8');
  
  // check if there are replacement characters
  if (text.includes('\uFFFD')) {
    console.log("File contains invalid UTF-8 bytes (converted to \\uFFFD).");
    // Just write it back as is (it will save \uFFFD as UTF-8 replacement chars)
    // The compiler will then just see standard valid UTF-8 strings.
    fs.writeFileSync(filePath, text, 'utf8');
    console.log("Fixed by converting invalid bytes to standard UTF-8 replacement characters.");
  } else {
    // maybe it has a byte sequence that Node's utf8 decoder handles but Next.js turbopack swc parser fails on?
    // let's just write it back to ensure it is clean utf-8.
    fs.writeFileSync(filePath, buffer.toString('utf8'), 'utf8');
    console.log("Re-saved as UTF-8.");
  }
} catch (err) {
  console.error(err);
}
