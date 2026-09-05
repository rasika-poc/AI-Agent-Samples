"""
Malware scanning on upload — PLAN.md §22, pulled forward into Phase 0 per the
roadmap note in §11 ("cheap to wire in before the upload path grows more entry
points, and easy to forget once several services can write to S3").

Talks to a clamd daemon (the `clamav/clamav` container) over TCP using the
INSTREAM command, so file bytes are scanned without ever touching disk on
either side.
"""

import io

import clamd

from .config import settings


class MalwareDetected(Exception):
    def __init__(self, signature: str):
        self.signature = signature
        super().__init__(f"malware detected: {signature}")


class ScannerUnavailable(Exception):
    pass


def scan_bytes(data: bytes) -> None:
    """Raises MalwareDetected if infected, ScannerUnavailable if clamd can't be reached."""
    if not settings.malware_scan_enabled:
        return
    try:
        client = clamd.ClamdNetworkSocket(host=settings.clamav_host, port=settings.clamav_port)
        result = client.instream(io.BytesIO(data))
    except (clamd.ConnectionError, OSError) as exc:
        raise ScannerUnavailable(str(exc)) from exc

    status, signature = result.get("stream", ("ERROR", "unknown"))
    if status == "FOUND":
        raise MalwareDetected(signature or "unknown")
    if status not in ("OK",):
        raise ScannerUnavailable(f"unexpected clamd response: {result}")
