#!/bin/bash

file="server/routes.ts"

# Create a temporary file
tmp_file=$(mktemp)

# Process the file line by line
line_num=0
in_team_query=false
where_clause_count=0
team_query_start=0

while IFS= read -r line; do
  ((line_num++))
  
  # Detect the start of a team query
  if [[ $line == *".from(teams)"* ]]; then
    in_team_query=true
    where_clause_count=0
    team_query_start=$line_num
  fi
  
  # Count where clauses in the current team query
  if [[ $in_team_query == true && $line == *".where("* ]]; then
    ((where_clause_count++))
  fi
  
  # Detect the end of a team query and insert isDeleted check if needed
  if [[ $in_team_query == true && $line == *".limit("* ]]; then
    in_team_query=false
    
    # If there's no isDeleted check, add it before the limit
    if ! grep -A5 -B1 ".from(teams)" $file | grep -A5 ".where(eq(teams.isDeleted, false))" | grep -q ".limit("; then
      # Add isDeleted check before the limit line
      echo -e "        .where(eq(teams.isDeleted, false))" >> $tmp_file
    fi
  fi
  
  # Write the current line to the temporary file
  echo "$line" >> $tmp_file
done < "$file"

# Replace the original file with the modified content
mv $tmp_file $file

echo "Added isDeleted checks to team queries in $file"
