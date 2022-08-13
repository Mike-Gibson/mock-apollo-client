const displayName = process.env.JEST_DISPLAY_NAME;

const additionalConfig = displayName
  ? { displayName }
  : {};

module.exports = {
  preset: 'ts-jest',
  ...additionalConfig,
};
