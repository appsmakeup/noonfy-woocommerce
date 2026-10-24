// Extends the stock @wordpress/scripts config: React, ReactDOM and @wordpress/* packages are
// externalised to the copies WordPress ships, and build/smtp.asset.php lists the script deps.
const defaultConfig = require('@wordpress/scripts/config/webpack.config');

module.exports = {
  ...defaultConfig,
  entry: { smtp: './src/index.tsx' },
};
