#!/bin/bash

# This script loops through a list of apollo client npm package versions
# and runs the jest tests for each version.
# Currently testing the latest release of each minor version.

apolloVersions=(
  "@apollo/client@4.0.7"
)
exitStatus=0

for apolloVersion in "${apolloVersions[@]}"
do
  echo "Running tests for $apolloVersion"

  npm install --no-save $apolloVersion
  npmExitCode=$?

  if [ $npmExitCode -ne 0 ]; then
    echo "npm install failed, exiting"
    exitStatus=99
    break
  fi

  export JEST_DISPLAY_NAME=$apolloVersion
  npm test -- || exitStatus=$?
done

# Revert changes to node_modules folder
npm install

echo "Finished"

exit $exitStatus
