const config = {
  presets: ['@babel/typescript'],
  plugins: ['@babel/plugin-proposal-class-properties'],
}

if (process.env.NODE_ENV === 'test') {
  config.presets.push(['@babel/env', { targets: { node: '10' } }])
  config.plugins.push('@babel/proposal-object-rest-spread')
}

// FIXME: keep optional chaining for modern build
if (true) {
  config.plugins.push('@babel/plugin-proposal-optional-chaining')
  config.plugins.push('@babel/plugin-proposal-nullish-coalescing-operator')
}

module.exports = config
