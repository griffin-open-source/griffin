export default {
  production: {
    endpoint_host: "https://api.production.example.com",
    api: {
      baseUrl: "https://api.production.example.com",
      timeout: 30000,
    },
    var1: "production-value-1",
  },
  staging: {
    endpoint_host: "https://api.staging.example.com",
    api: {
      baseUrl: "https://api.staging.example.com",
      timeout: 30000,
    },
    var1: "staging-value-1",
  },
  development: {
    endpoint_host: "http://localhost:3000",
    api: {
      baseUrl: "http://localhost:3000",
      timeout: 10000,
    },
    var1: "development-value-1",
  },
};
