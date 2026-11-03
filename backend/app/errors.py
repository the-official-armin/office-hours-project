"""Rule violation error — the backend answers with { code, message }, see docs/api-contract.md."""


class RuleError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


# HTTP status per rule code: everything is a 409 unless mapped here.
# (Malformed request bodies that never reach the rules stay FastAPI's native 422.)
_STATUS_BY_CODE = {
    "not_found": 404,
}


def status_for(code: str) -> int:
    return _STATUS_BY_CODE.get(code, 409)
