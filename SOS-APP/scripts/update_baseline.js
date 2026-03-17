const fs = require('fs');
const path = require('path');

const csvPath = 'd:/VS CODE PROJECTS/Bored_projects/SOS-APP/SOS-APP/datasets/Accelerometer.csv';
const outputFilePath = 'd:/VS CODE PROJECTS/Bored_projects/SOS-APP/SOS-APP/app/ml/baselineData.ts';

function processCsv() {
    try {
        const data = fs.readFileSync(csvPath, 'utf8');
        const lines = data.split('\n');
        const magnitudes = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',');
            if (parts.length < 5) continue;

            const x = parseFloat(parts[2]);
            const y = parseFloat(parts[3]);
            const z = parseFloat(parts[4]);

            if (isNaN(x) || isNaN(y) || isNaN(z)) continue;

            const magnitude = Math.sqrt(x * x + y * y + z * z);
            magnitudes.push(magnitude);

            if (magnitudes.length >= 1500) break;
        }

        const content = `export const REAL_DRIVING_MOTION_SAMPLES: number[] = [\n  ${magnitudes.join(',\n  ')}\n];\n`;
        fs.writeFileSync(outputFilePath, content);
        console.log(`Successfully updated ${outputFilePath} with ${magnitudes.length} samples.`);
    } catch (e) {
        console.error("Error processing CSV:", e);
        process.exit(1);
    }
}

processCsv();
