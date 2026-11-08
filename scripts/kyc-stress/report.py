import json, sys, collections
rows=[json.loads(l) for l in open(sys.argv[1])]
SAFE={"NEEDS_REUPLOAD","MANUAL_REVIEW"}
def grade(r):
    e,v=r["expect"],r["verdict"]
    if v=="CRASH": return "CRASH"
    if v in e: return "ok"
    good = e[0] in ("PASS","PASS_WITH_WARNINGS")
    if good and v in ("PASS","PASS_WITH_WARNINGS"): return "ok"
    if good and v in SAFE: return "soft"      # genuine asked to retake / reviewed
    if good and v=="REJECT": return "FALSE_REJECT"
    if not good and v in ("PASS","PASS_WITH_WARNINGS"): return "FALSE_ACCEPT"
    if not good and v in SAFE|{"REJECT"}: return "soft" if v!=e[0] else "ok"
    return "other"
c=collections.Counter(); byvar=collections.defaultdict(collections.Counter)
for r in rows:
    g=grade(r); r["g"]=g; c[g]+=1; byvar[r["variant"]][g]+=1
print(dict(c), "n=",len(rows), "max ms", max(r["ms"] for r in rows), "avg", sum(r["ms"] for r in rows)//len(rows))
for v,cc in sorted(byvar.items()): print(f"  {v:12s}", dict(cc))
for r in rows:
    if r["g"]!="ok" and (len(sys.argv)<3 or r["g"] in sys.argv[2].split(",")):
        print(f'{r["g"]:13s} {r["id"]} {r["variant"]:10s} exp={r["expect"][0]} got={r["verdict"]} {r.get("q","")}\n     ', " | ".join(r.get("fails",[]))[:400], r.get("error",""))
