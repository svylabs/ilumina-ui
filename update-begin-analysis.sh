#!/bin/bash

# Copy the file for backup
cp server/routes.ts server/routes.ts.bak2

# Replace the first occurrence
sed -i '2874s|const analysisResponse = await fetch.*|const baseUrl = process.env.ILUMINA_API_BASE_URL || "https://ilumina-wf-tt2cgoxmbq-uc.a.run.app/api";\n      const apiKey = process.env.ILUMINA_API_KEY || "my_secure_password";\n      const analysisResponse = await fetch(`${baseUrl}/begin_analysis`, {|' server/routes.ts

# Replace Bearer my_secure_password in the first occurrence
sed -i '2877s|Authorization.*|Authorization`: `Bearer ${apiKey}`,|' server/routes.ts

# Replace the second occurrence
sed -i '3063s|const analysisResponse = await fetch.*|const baseUrl = process.env.ILUMINA_API_BASE_URL || "https://ilumina-wf-tt2cgoxmbq-uc.a.run.app/api";\n      const apiKey = process.env.ILUMINA_API_KEY || "my_secure_password";\n      const analysisResponse = await fetch(`${baseUrl}/begin_analysis`, {|' server/routes.ts

# Replace Bearer my_secure_password in the second occurrence
sed -i '3066s|Authorization.*|Authorization`: `Bearer ${apiKey}`,|' server/routes.ts

