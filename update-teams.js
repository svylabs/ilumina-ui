const fs = require('fs');
const path = require('path');

const routesPath = path.join('server', 'routes.ts');
let content = fs.readFileSync(routesPath, 'utf8');

// Find all teams queries that don't check for isDeleted
const pattern = /\.from\(teams\)([\s\n]+)\.where\(eq\(teams\.id,\s*teamId\)\)([\s\n]+)\.limit\(1\)/g;

content = content.replace(pattern, '.from(teams)$1.where(eq(teams.id, teamId))$1.where(eq(teams.isDeleted, false))$2.limit(1)');

fs.writeFileSync(routesPath, content);
console.log('Updated teams queries to filter out deleted teams');
