import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env } from "./config";

const s3 = new S3Client({
  endpoint: env.minioEndpoint,
  region: "us-east-1",
  credentials: { accessKeyId: env.minioAccessKey, secretAccessKey: env.minioSecretKey },
  forcePathStyle: true,
});

export async function getObject(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: env.minioBucket, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({ Bucket: env.minioBucket, Key: key, Body: body, ContentType: contentType }),
  );
}
