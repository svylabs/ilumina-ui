import fs from 'fs';

// Read the file
const filePath = 'server/routes.ts';
let fileContent = fs.readFileSync(filePath, 'utf8');

// Add the joinPath helper at the top level (outside of any function)
let joinPathFunc = `
// Helper to ensure we don't have double slashes in URLs
function joinPath(base, path) {
  if (base.endsWith('/') && path.startsWith('/')) {
    return base + path.substring(1);
  } else if (!base.endsWith('/') && !path.startsWith('/')) {
    return base + '/' + path;
  }
  return base + path;
}
`;

// Insert the joinPath helper after the callExternalIluminaAPI function declaration
fileContent = fileContent.replace(
  /async function callExternalIluminaAPI\(endpoint: string, method: 'GET' \| 'POST' = 'GET', body\?: any\): Promise<Response> {/,
  `async function callExternalIluminaAPI(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<Response> {${joinPathFunc}`
);

// Update the URL construction in callExternalIluminaAPI
fileContent = fileContent.replace(
  /const url = `\${baseUrl}\${endpoint\.startsWith\('\/'\) \? endpoint : '\/' \+ endpoint}`;/,
  'const url = joinPath(baseUrl, endpoint);'
);

// Remove the duplicate joinPath functions inside the try blocks
fileContent = fileContent.replace(
  /      \/\/ Helper to ensure we don't have double slashes in URLs\n      const joinPath = \(base, path\) => \{\n(.*\n){7}      \};\n/g,
  ''
);

// Write the file back
fs.writeFileSync(filePath, fileContent);

console.log('URL path handling helpers updated for consistency');