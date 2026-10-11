module.exports = function validateEnv() {
  const missing = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET', 'CORS_ORIGIN'].filter((k) => !process.env[k]);
  const problems = missing.map((k) => k + ' is missing');
  const prod = process.env.NODE_ENV === 'production';
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) problems.push('JWT_SECRET must be at least 32 characters');
  if (prod && process.env.CORS_ORIGIN && !/^https:\/\//.test(process.env.CORS_ORIGIN)) problems.push('CORS_ORIGIN must be https in production');
  if (prod && /^(root)$/.test(process.env.DB_USER || '')) problems.push('DB_USER must not be root in production');
  if (problems.length) {
    console.error('Startup configuration errors:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
};
