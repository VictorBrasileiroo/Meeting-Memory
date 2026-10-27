// A build-time constant prevents a short test duration from entering the production bundle.
export const CHUNK_TARGET_DURATION_MS = __CHUNK_TEST__ ? 10_000 : 1_770_000;
export const OVERLAP_TARGET_MS = 1_000;
export const FRAGMENT_TIMESLICE_MS = __CHUNK_TEST__ ? 1_000 : 5_000;
export const FUTURE_MAX_DURATION_MS = 1_800_000;
export const CHUNK_CONFIG_MODE = __CHUNK_TEST__ ? 'CHUNK_TEST_10_SECONDS' : 'CHUNK_PRODUCTION_29_30';
