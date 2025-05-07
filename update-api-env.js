import fs from 'fs';

// Read the file
const filePath = 'server/routes.ts';
let fileContent = fs.readFileSync(filePath, 'utf8');

// Replace all direct URLs with environment variables
fileContent = fileContent.replace(
  /const analysisResponse = await fetch\('https:\/\/ilumina-451416\.uc\.r\.appspot\.com\/api\/begin_analysis'/g,
  `const baseUrl = process.env.ILUMINA_API_BASE_URL || 'https://ilumina-wf-tt2cgoxmbq-uc.a.run.app/api';
      const apiKey = process.env.ILUMINA_API_KEY || 'my_secure_password';
      const analysisResponse = await fetch(\`\${baseUrl}/begin_analysis\``
);

// Replace all occurrences of the API key
fileContent = fileContent.replace(
  /'Authorization': 'Bearer my_secure_password'/g,
  `'Authorization': \`Bearer \${apiKey}\``
);

// Write the file back
fs.writeFileSync(filePath, fileContent);

console.log('API URL and keys updated to use environment variables');