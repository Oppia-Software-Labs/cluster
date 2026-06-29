// API ESLint flat config — extends the shared Cluster config (@cluster/config).
// ESLint 9 requires a flat config; the api lint script (`eslint "{src,test}/**/*.ts"`)
// resolves this file.
import base from "@cluster/config/eslint";

export default base;
