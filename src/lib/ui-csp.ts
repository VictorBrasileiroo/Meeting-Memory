import { z } from 'zod';

// UI bootstrap only. Use Zod's supported interpreter under strict MV3 CSP;
// skip its caught eval capability probe without changing any schema or rule.
z.config({ jitless: true });
