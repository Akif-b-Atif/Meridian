"""Köppen-Geiger classification after Peel, Finlayson and McMahon (2007). Order: E, B, A, C, D."""

from __future__ import annotations

from typing import Any


def classify(tm: list[float], pm: list[float], hemisphere: str = "N") -> dict[str, Any]:
    mat = sum(tm) / 12.0
    map_ = sum(pm)
    thot, tcold = max(tm), min(tm)
    tmon10 = sum(1 for t in tm if t > 10)
    pdry = min(pm)

    amjjas = [3, 4, 5, 6, 7, 8]  # April to September (0-based)
    ondjfm = [9, 10, 11, 0, 1, 2]
    s_amjjas, s_ondjfm = sum(tm[i] for i in amjjas), sum(tm[i] for i in ondjfm)
    if s_amjjas > s_ondjfm or (s_amjjas == s_ondjfm and hemisphere == "N"):
        summer, winter = amjjas, ondjfm
    else:
        summer, winter = ondjfm, amjjas
    ps = [pm[i] for i in summer]
    pw = [pm[i] for i in winter]
    psdry, pswet, pwdry, pwwet = min(ps), max(ps), min(pw), max(pw)

    if map_ > 0 and sum(pw) / map_ >= 0.7:
        pth = 2 * mat
    elif map_ > 0 and sum(ps) / map_ >= 0.7:
        pth = 2 * mat + 28
    else:
        pth = 2 * mat + 14

    if thot < 10:
        code = "ET" if thot > 0 else "EF"
    elif map_ < 10 * pth:
        code = "B" + ("W" if map_ < 5 * pth else "S") + ("h" if mat >= 18 else "k")
    elif tcold >= 18:
        if pdry >= 60:
            code = "Af"
        elif pdry >= 100 - map_ / 25:
            code = "Am"
        else:
            code = "Aw"
    elif thot > 10 and tcold > 0:
        code = "C" + _second(psdry, pwdry, pswet, pwwet) + _third(thot, tmon10, tcold, False)
    else:
        code = "D" + _second(psdry, pwdry, pswet, pwwet) + _third(thot, tmon10, tcold, True)
    return {
        "code": code,
        "thot": round(thot, 1),
        "tcold": round(tcold, 1),
        "pthreshold": round(pth, 1),
    }


def _second(psdry: float, pwdry: float, pswet: float, pwwet: float) -> str:
    if psdry < 40 and psdry < pwwet / 3:
        return "s"
    if pwdry < pswet / 10:
        return "w"
    return "f"


def _third(thot: float, tmon10: int, tcold: float, allow_d: bool) -> str:
    if thot >= 22:
        return "a"
    if tmon10 >= 4:
        return "b"
    if allow_d and tcold < -38:
        return "d"
    return "c"


NAMES = {
    "Af": "Tropical rainforest", "Am": "Tropical monsoon", "Aw": "Tropical savanna",
    "BWh": "Hot desert", "BWk": "Cold desert", "BSh": "Hot semi-arid", "BSk": "Cold semi-arid",
    "Csa": "Hot-summer Mediterranean", "Csb": "Warm-summer Mediterranean",
    "Csc": "Cold-summer Mediterranean", "Cwa": "Humid subtropical, dry winter",
    "Cwb": "Subtropical highland, dry winter", "Cwc": "Cold subtropical highland, dry winter",
    "Cfa": "Humid subtropical", "Cfb": "Temperate oceanic", "Cfc": "Subpolar oceanic",
    "Dsa": "Hot-summer continental, dry summer", "Dsb": "Warm-summer continental, dry summer",
    "Dsc": "Subarctic, dry summer", "Dsd": "Extremely cold subarctic, dry summer",
    "Dwa": "Hot-summer continental, dry winter", "Dwb": "Warm-summer continental, dry winter",
    "Dwc": "Subarctic, dry winter", "Dwd": "Extremely cold subarctic, dry winter",
    "Dfa": "Hot-summer humid continental", "Dfb": "Warm-summer humid continental",
    "Dfc": "Subarctic", "Dfd": "Extremely cold subarctic", "ET": "Tundra", "EF": "Ice cap",
}  # fmt: skip
