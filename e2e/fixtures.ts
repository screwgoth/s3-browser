/** Shared test fixtures / constants. */

export const ADMIN = {
  username: 'admin',
  password: 'AdminPass123',
};

export const VIEWER = {
  username: 'e2e_viewer',
  password: 'ViewerPass123',
};

export const TEST_BUCKET_ALIAS = 'E2E Test Bucket';

export const TEST_BUCKET = {
  alias: TEST_BUCKET_ALIAS,
  bucketName: 'e2e-test-bucket',
  region: 'us-east-1',
  // Dummy credentials — we never actually connect to S3; we only verify
  // the config is persisted and visible in the UI / DB.
  accessKeyId: 'AKIAE2ETESTKEY000000',
  secretAccessKey: 'e2eSecretKeyDoNotUse0000000000000000000000',
};
