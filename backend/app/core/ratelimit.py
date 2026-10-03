"""Per-IP sliding-window limits held in memory only."""

from __future__ import annotations

import math
import time
from collections import OrderedDict, deque

from ..errors import ApiError, make_error


class SlidingWindow:
    def __init__(self, limit: int, window_s: float, max_ips: int = 5000) -> None:
        self.limit, self.window, self.max_ips = limit, window_s, max_ips
        self.hits: OrderedDict[str, deque[float]] = OrderedDict()

    def _prune(self, dq: deque[float], t: float) -> None:
        while dq and t - dq[0] >= self.window:
            dq.popleft()

    def _purge_idle(self, t: float) -> None:
        for ip in [k for k, dq in self.hits.items() if not dq or t - dq[-1] > 120]:
            del self.hits[ip]
        while len(self.hits) >= self.max_ips:
            self.hits.popitem(last=False)

    def count(self, ip: str) -> int:
        dq = self.hits.get(ip)
        if not dq:
            return 0
        self._prune(dq, time.monotonic())
        return len(dq)

    def retry_after(self, ip: str) -> int:
        dq = self.hits.get(ip)
        if not dq:
            return 1
        return max(1, math.ceil(self.window - (time.monotonic() - dq[0])))

    def add(self, ip: str) -> None:
        t = time.monotonic()
        if ip not in self.hits:
            self._purge_idle(t)
            self.hits[ip] = deque()
        self.hits.move_to_end(ip)
        self.hits[ip].append(t)

    def check_only(self, ip: str) -> None:
        if self.count(ip) >= self.limit:
            raise make_error("RATE_LIMITED", retry_after=self.retry_after(ip))

    def check_and_add(self, ip: str) -> None:
        if self.count(ip) >= self.limit:
            raise make_error("RATE_LIMITED", retry_after=self.retry_after(ip))
        self.add(ip)


def rate_limited(exc: Exception) -> bool:
    return isinstance(exc, ApiError) and exc.code == "RATE_LIMITED"
