import nextVitals from 'eslint-config-next/core-web-vitals';

export default [
  ...nextVitals,
  {
    ignores: ['.next/**', 'node_modules/**'],
    rules: {
      'react-hooks/set-state-in-effect': 'off'
    }
  }
];
