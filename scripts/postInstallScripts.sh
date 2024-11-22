echo "**Acoustic Integration***********************************************************************"
node ./scripts/reviewConnectConfig.js
node ./scripts/javaParser.js 
node ./scripts/xmlParser.js
node ./scripts/gradleParser.js
echo "*********************************************************************************************"