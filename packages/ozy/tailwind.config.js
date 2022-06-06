const { createGlobPatternsForDependencies } = require('@nrwl/react/tailwind');
const plugin = require('tailwindcss/plugin');
const tailwindCompile = require('tailwindcss');

module.exports = {
  content: [
    './src/**/*!(*.stories|*.spec).{ts,tsx,html}',
    ...createGlobPatternsForDependencies(__dirname),
    'node_modules/flowbite-react/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {},
  },
  plugins: [
    plugin(function(inputs) {
      console.log("start plugin");
      //console.log(inputs);
      //console.log(JSON.stringify(inputs));
      const processor = inputs.postcss();
      console.log(processor);
      console.log(JSON.stringify(processor));
    })
  ],
  safelist: [
    {
      pattern: /./
    }
  ]
}
