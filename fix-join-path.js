import fs from 'fs';

// Read the file
const filePath = 'server/routes.ts';
let fileContent = fs.readFileSync(filePath, 'utf8');

// First, extract the joinPath function from inside callExternalIluminaAPI
let joinPathFuncStr = fileContent.match(/function joinPath\(base, path\) \{[\s\S]+?return base \+ path;\s+\}/)[0];

// Remove existing joinPath definition from callExternalIluminaAPI
fileContent = fileContent.replace(
  /\/\/ Helper to ensure we don't have double slashes in URLs\nfunction joinPath\(base, path\) \{[\s\S]+?return base \+ path;\s+\}/,
  ''
);

// Add the joinPath function at the top level, just after the AnalysisStepStatus type
fileContent = fileContent.replace(
  /type AnalysisStepStatus = \{[\s\S]+?\};/,
  match => match + '\n\n// Helper to ensure we don\'t have double slashes in URLs\n' + joinPathFuncStr
);

// Remove all the other local joinPath function declarations
fileContent = fileContent.replace(
  /      \/\/ Helper to ensure we don't have double slashes in URLs\n      const joinPath = \(base, path\) => \{[\s\S]+?      \};\n/g,
  ''
);

// Write the file back
fs.writeFileSync(filePath, fileContent);

console.log('joinPath helper function consolidated into a single reusable function');