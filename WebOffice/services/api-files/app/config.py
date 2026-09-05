from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = (
        "postgresql://weboffice_app:weboffice_app_dev_password@postgres:5432/weboffice"
    )
    jwt_secret: str = "dev-only-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 480  # matches tenant_policies.session_timeout_minutes default

    # Phase 0 ships with exactly one tenant (see infra/postgres/init/03_seed.sql).
    # Self-serve tenant provisioning is PLAN.md §20 (Phase 2+).
    default_tenant_id: str = "00000000-0000-0000-0000-000000000001"

    minio_endpoint: str = "http://minio:9000"
    minio_access_key: str = "weboffice"
    minio_secret_key: str = "weboffice_dev_secret"
    minio_bucket: str = "weboffice"

    clamav_host: str = "clamav"
    clamav_port: int = 3310
    malware_scan_enabled: bool = True  # PLAN.md §22 — toggle-able off for local dev

    max_upload_size_bytes: int = 25 * 1024 * 1024  # 25 MiB, Phase 0 default

    class Config:
        env_file = ".env"


settings = Settings()
