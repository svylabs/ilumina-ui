#!/bin/bash

# Create backup of the file
cp server/routes.ts server/routes.ts.bak

# Replace all occurrences of the API URL
sed -i 's|https://ilumina-451416.uc.r.appspot.com/api|${process.env.ILUMINA_API_BASE_URL || "https://ilumina-wf-tt2cgoxmbq-uc.a.run.app/api"}|g' server/routes.ts

# Replace all occurrences of the API key
sed -i 's|Bearer my_secure_password|Bearer ${process.env.ILUMINA_API_KEY || "my_secure_password"}|g' server/routes.ts
