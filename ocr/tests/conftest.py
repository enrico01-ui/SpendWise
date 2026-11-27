from collections import defaultdict
from typing import Any

import pytest


_PARSER_PASSES: dict[str, int] = defaultdict(int)
_PARSER_TOTALS: dict[str, int] = defaultdict(int)


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo[Any]):
    outcome = yield
    report = outcome.get_result()
    callspec = getattr(item, "callspec", None)
    if report.when != "call" or callspec is None or "field" not in callspec.params:
        return
    field = callspec.params["field"]
    _PARSER_TOTALS[field] += 1
    if report.passed:
        _PARSER_PASSES[field] += 1


def pytest_terminal_summary(terminalreporter: Any) -> None:
    if not _PARSER_TOTALS:
        return
    terminalreporter.write_sep("=", "Parser passes by field")
    for field in ("merchant", "date", "total", "items"):
        terminalreporter.write_line(
            f"{field}: {_PARSER_PASSES[field]}/{_PARSER_TOTALS[field]}"
        )
