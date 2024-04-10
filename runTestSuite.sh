#!/bin/bash

# This script loops through a list of apollo client npm package versions
# and runs the jest tests for each version.
# Currently testing the latest release of each minor version.

apolloVersions=(
  "@apollo/client@3.0.2"
  "@apollo/client@3.1.5"
  "@apollo/client@3.2.9"
  "@apollo/client@3.3.21"
  "@apollo/client@3.4.17"
  "@apollo/client@3.5.10"
  "@apollo/client@3.6.10"
  "@apollo/client@3.7.17"
  "@apollo/client@3.8.10"
  "@apollo/client@3.9.11"
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
