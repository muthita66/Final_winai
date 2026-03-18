const fs = require('fs');

try {
  const filePath = 'd:\\new\\WinAi_SeeuNextLift\\src\\features\\director\\components\\CrudFeatures.tsx';
  console.log("Reading file:", filePath);
  const buffer = fs.readFileSync(filePath);
  console.log("File size:", buffer.length);
  
  // Convert buffer to string replacing invalid chars with 
  const textDecoder = new TextDecoder('utf-8', { fatal: false });
  const decoded = textDecoder.decode(buffer);
  
  // Write it back as UTF-8
  const newBuffer = Buffer.from(decoded, 'utf-8');
  fs.writeFileSync(filePath, newBuffer);
  
  console.log("Successfully rewrote file. New size:", newBuffer.length);
} catch (e) {
  console.error("Error:", e);
}
