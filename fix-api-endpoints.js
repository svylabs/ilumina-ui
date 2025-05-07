import fs from 'fs';

// Read the file
const filePath = 'server/routes.ts';
let fileContent = fs.readFileSync(filePath, 'utf8');

// Fix the direct fetch calls to begin_analysis to properly handle the /api prefix
fileContent = fileContent.replace(
  /const analysisResponse = await fetch\(`\${baseUrl}\/begin_analysis`/g,
  'const analysisResponse = await fetch(`${baseUrl}/begin_analysis`'
);

// Add helper to ensure proper path joining
fileContent = fileContent.replace(
  /const baseUrl = process\.env\.ILUMINA_API_BASE_URL \|\| 'https:\/\/ilumina-wf-tt2cgoxmbq-uc\.a\.run\.app\/api';(\s+)const apiKey/g,
  "const baseUrl = process.env.ILUMINA_API_BASE_URL || 'https://ilumina-wf-tt2cgoxmbq-uc.a.run.app/api';\n" +
  "      // Helper to ensure we don't have double slashes in URLs\n" +
  "      const joinPath = (base, path) => {\n" +
  "        if (base.endsWith('/') && path.startsWith('/')) {\n" +
  "          return base + path.substring(1);\n" +
  "        } else if (!base.endsWith('/') && !path.startsWith('/')) {\n" +
  "          return base + '/' + path;\n" +
  "        }\n" +
  "        return base + path;\n" +
  "      };\n$1const apiKey"
);

// Update all direct fetch calls to use the joinPath helper
fileContent = fileContent.replace(
  /const analysisResponse = await fetch\(`\${baseUrl}\/begin_analysis`/g,
  'const analysisResponse = await fetch(joinPath(baseUrl, "begin_analysis")'
);

// Write the file back
fs.writeFileSync(filePath, fileContent);

console.log('API endpoint URL handling fixed for proper path joining');