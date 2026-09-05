import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError

from .config import settings

_s3 = boto3.client(
    "s3",
    endpoint_url=settings.minio_endpoint,
    aws_access_key_id=settings.minio_access_key,
    aws_secret_access_key=settings.minio_secret_key,
    config=BotoConfig(signature_version="s3v4"),
    region_name="us-east-1",
)


def ensure_bucket() -> None:
    try:
        _s3.head_bucket(Bucket=settings.minio_bucket)
    except ClientError:
        _s3.create_bucket(Bucket=settings.minio_bucket)


def put_object(key: str, data: bytes, content_type: str) -> None:
    _s3.put_object(Bucket=settings.minio_bucket, Key=key, Body=data, ContentType=content_type)


def get_object(key: str) -> bytes:
    return _s3.get_object(Bucket=settings.minio_bucket, Key=key)["Body"].read()


def delete_object(key: str) -> None:
    _s3.delete_object(Bucket=settings.minio_bucket, Key=key)
