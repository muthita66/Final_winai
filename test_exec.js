const fs = require('fs');
const { execSync } = require('child_process');

try {
    const nodeV = execSync('node -v').toString();
    const npmV = execSync('npm -v').toString();
    const dir = execSync('dir').toString();
    
    const output = `Node: ${nodeV}\nNPM: ${npmV}\nDir:\n${dir}`;
    fs.writeFileSync('output_test.txt', output);
} catch (err) {
    fs.writeFileSync('output_test.txt', `Error: ${err.message}`);
}
