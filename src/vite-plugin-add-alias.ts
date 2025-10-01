import { Plugin } from 'vite';

export function addAliasPlugin(): Plugin {
  return {
    name: 'vite-plugin-add-alias',
    config(config) {
      // Ensure that the alias section exists
      config.resolve = config.resolve || {};
      config.resolve.alias = config.resolve.alias || {};

      // Dynamically resolve the src directory
      // In this case, we avoid using `path` entirely to prevent issues in the browser
      const srcPath = `${__dirname}/src`; // Relative path for bundling

      // Add the alias for `@src`
      config.resolve.alias['@src'] = srcPath;

      return config;
    },
  };
}
