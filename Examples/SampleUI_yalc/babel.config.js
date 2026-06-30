const path = require('path');

module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          extensions: ['.tsx', '.ts', '.js', '.json'],
          alias: {
            'react-native-vector-icons': '@expo/vector-icons', //Fixes issue with icons not showing up on web (I also had to add @expo/vector-icons to react-native-paper devDependencies)
          },
        },
      ],
      ['@babel/plugin-proposal-export-namespace-from'],
      ['react-native-reanimated/plugin'],
    ],
  };
};