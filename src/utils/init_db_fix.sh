#!/bin/bash
sed -i '
/sortOrder: [0-9]/s/$/,\n            updatedAt: new Date()/
/code: "T[JMUKZ]"/s/$/,\n        updatedAt: new Date()/
/order: [0-9]/s/$/,\n        updatedAt: new Date()/
' initializeDatabase.ts
echo "✅ Added updatedAt fields"
