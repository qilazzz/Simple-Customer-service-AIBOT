const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Avoid SDK 54 ESM import issues with some dependencies at runtime.
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
  },
});

module.exports = config;
