const env = process.env;
Object.keys(env).forEach(key => {
  if (!key.includes('KEY') && !key.includes('PASS') && !key.includes('SECRET')) {
    console.log(`${key}: ${env[key]}`);
  }
});
