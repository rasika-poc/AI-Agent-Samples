export const env = {
  port: Number(process.env.PORT ?? 1234),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://weboffice_app:weboffice_app_dev_password@postgres:5432/weboffice",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-change-me",
  jwtAlgorithm: process.env.JWT_ALGORITHM ?? "HS256",
  minioEndpoint: process.env.MINIO_ENDPOINT ?? "http://minio:9000",
  minioAccessKey: process.env.MINIO_ACCESS_KEY ?? "weboffice",
  minioSecretKey: process.env.MINIO_SECRET_KEY ?? "weboffice_dev_secret",
  minioBucket: process.env.MINIO_BUCKET ?? "weboffice",
};
