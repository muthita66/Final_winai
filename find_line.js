const fs = require('fs');
const content = fs.readFileSync('src/features/director/director.service.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
    if (line.includes('getLearningSubjectGroups')) {
        console.log(`${i + 1}: ${line}`);
    }
});
