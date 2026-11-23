#!/usr/bin/env python3
"""
把从 SLCM 抓下来的 master_<学号>.json 合成一个给 TM「导入 SLCM 成绩」用的小档案。

用法:  python3 TM/tools/build_slcm_bundle.py _backups/slcm_2026-11-23
输出:  <资料夹>/slcm_bundle.json   （不含姓名；资料夹在 .gitignore 的 _backups/ 里，不会进公开仓库）

格式 (version 1):
{
  "version": 1, "generatedAt": "...", "currentSem": "2569/1",
  "students": {
    "<学号>": {
      "gpax": 2.03 | null,
      "earned": "48.00/123",            # 名单页的「已取得学分/总学分」
      "sems":    [[year, sem, gpa, att, ern, tgp, ccr, cgpa], ...],   # 已按时间排序；还没出成绩的学期数字为 null
      "courses": [[code, year, sem, credit, grade|null, retakeTimes, name], ...]
    }
  }
}
"""
import glob, json, os, sys


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def main(folder):
    files = sorted(glob.glob(os.path.join(folder, "master_*.json")))
    if not files:
        sys.exit("找不到 master_*.json: " + folder)
    students, newest, stamp = {}, (0, 0), ""
    for fn in files:
        p = json.load(open(fn, encoding="utf-8"))
        m = p["master"]["data"]
        code = str(p["studentCode"])
        sems = sorted(m["getSearchGpa"], key=lambda r: (r["year"], r["semester"]))
        courses = sorted(m["getSearchSubj"], key=lambda r: (r["year"], r["semester"], r["subjectCode"]))
        for r in sems + courses:
            newest = max(newest, (r["year"], r["semester"]))
        stamp = max(stamp, p.get("fetchedAt", ""))
        students[code] = {
            "gpax": num(p.get("listGpax")),
            "earned": p.get("numberToTotal"),
            "sems": [[r["year"], r["semester"], num(r["gpa"]), num(r["att"]), num(r["ern"]),
                      num(r["tgp"]), num(r["ccr"]), num(r["cgpa"])] for r in sems],
            "courses": [[r["subjectCode"], r["year"], r["semester"], r["credit"],
                         r.get("gradeInput"), r.get("registerTime") or 0, r.get("subjectName")] for r in courses],
        }
    out = {"version": 1, "generatedAt": stamp, "currentSem": "%d/%d" % newest, "students": students}
    dst = os.path.join(folder, "slcm_bundle.json")
    json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("学生 %d 位 · 最新学期 %s · %s (%d KB)" % (len(students), out["currentSem"], dst, os.path.getsize(dst) // 1024))


if __name__ == "__main__":
    main(sys.argv[1])
