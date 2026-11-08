"""Synthetic KYC applicants in the exact layout/fonts of the case specimens + degraded variants."""
import csv, json, random, os, io, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import numpy as np, cv2

random.seed(7); np.random.seed(7)
DATA = "data"
OUT = "scripts/kyc-stress/out/corpus"; os.makedirs(OUT, exist_ok=True)
F = "/usr/share/fonts/truetype/dejavu/"
font = lambda n, s: ImageFont.truetype(F + n, s)
SANS, BOLD, MONO = "DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSansMono.ttf"
CH = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
def check(f14):
    t = 0
    for i, c in enumerate(f14):
        p = CH.index(c) * (1 if i % 2 == 0 else 2); t += p // 36 + p % 36
    return CH[(36 - t % 36) % 36]

def watermark(img):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    txt = "SYNTHETIC SPECIMEN - NOT A VALID DOCUMENT"; f = font(BOLD, 46)
    for (x, y) in [(-20, 520), (60, 900), (240, 1290), (420, 1680), (560, 120)]:
        t = Image.new("RGBA", (1600, 80), (0, 0, 0, 0)); ImageDraw.Draw(t).text((0, 0), txt, font=f, fill=(214, 120, 110, 120))
        t = t.rotate(22, expand=True); layer.alpha_composite(t, (x, y - t.size[1] + 40))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")

def page(title, subtitle, rows):
    img = Image.new("RGB", (1240, 1754), (253, 253, 249)); d = ImageDraw.Draw(img)
    d.rectangle([40, 40, 1200, 190], fill=(232, 235, 244)); d.rectangle([40, 190, 1199, 1712], outline=(50, 50, 50), width=3)
    d.text((80, 72), title, font=font(BOLD, 40), fill=(22, 32, 66)); d.text((80, 132), subtitle, font=font(SANS, 20), fill=(70, 70, 70))
    y = 252
    for label, value, mono in rows:
        if label is not None: d.text((90, y), label, font=font(BOLD, 22), fill=(40, 40, 40))
        if value: d.text((520, y), value, font=font(MONO if mono else SANS, 24 if not (label or "").startswith(("Address", "Supply", "  place")) and value[:4] != "dhra" else 22), fill=(15, 15, 15))
        y += 70
    d.text((80, 1662), "Accel YTL Hackathon - Track A test data. Fictional business, person and identifiers.", font=font(SANS, 19), fill=(150, 30, 30))
    return watermark(img)

def split_addr(a, n=45): return (a[:n], a[n:]) if len(a) > n else (a, "")

def gst_doc(g, legal, trade, const, addr, dol):
    a1, a2 = split_addr(addr)
    rows = [("GSTIN", g, True), ("Legal name", legal, False), ("Trade name", trade, False), ("Constitution", const, False),
            ("Address of principal", a1, False), ("  place of business", a2, False), ("Date of liability", dol, False), ("Type of registration", "Regular", False)]
    return page("Specimen: GST Registration Certificate", "Format for hackathon OCR testing only", rows)

def udyam_doc(u, name, act, city, state, dor):
    rows = [("Udyam reg. number", u, True), ("Enterprise name", name, False), ("Major activity", act, False), ("City", city, False), ("State", state, False), ("Date of registration", dor, False)]
    return page("Specimen: Udyam Registration Certificate", "Format for hackathon OCR testing only", rows)

def bill_doc(name, addr, date):
    a1, a2 = split_addr(addr)
    rows = [("Consumer no.", str(random.randint(10**9, 10**10 - 1)), True), ("Billed to", name, False), ("Supply address", a1, False), (None, a2, False),
            ("Bill date", date, False), ("Units consumed", str(random.randint(200, 4000)), False), ("Amount due (INR)", f"{random.randint(1000, 60000):,}", False)]
    return page("Specimen: Electricity Bill", "Fictional utility - address proof for OCR testing", rows)

def sig_doc(name, desig, biz, valid):
    img = Image.new("RGB", (1012, 638), (244, 247, 252)); d = ImageDraw.Draw(img)
    d.rounded_rectangle([10, 10, 1001, 627], radius=30, outline=(40, 60, 100), width=4)
    d.text((40, 36), "Specimen: Authorised Signatory ID", font=font(BOLD, 34), fill=(25, 45, 95))
    d.rectangle([40, 120, 300, 440], fill=(210, 214, 222)); d.ellipse([110, 160, 230, 280], fill=(168, 175, 186)); d.rectangle([90, 300, 250, 440], fill=(168, 175, 186))
    y = 130
    for lab, val in [("Name", name), ("Designation", desig), ("For business", biz), ("ID no.", f"SYN-ID-{random.randint(100000, 999999)}"), ("Valid till", valid)]:
        d.text((340, y), lab, font=font(SANS, 20), fill=(85, 85, 85)); d.text((340, y + 24), val, font=font(BOLD, 26), fill=(10, 10, 10)); y += 70
    d.text((40, 520), "SYNTHETIC SPECIMEN - NOT A VALID DOCUMENT", font=font(BOLD, 32), fill=(220, 120, 120))
    return img

G = list(csv.DictReader(open(f"{DATA}/mock_gstin_registry.csv")))
U = list(csv.DictReader(open(f"{DATA}/mock_udyam_registry.csv")))
umap = {u["enterprise_name"].lower(): u for u in U}
active = [g for g in G if g["status"] == "Active"]
random.shuffle(active)
prop = [g for g in active if g["constitution"] == "Proprietorship"]
pvt = [g for g in active if g["constitution"] != "Proprietorship"]
canc = [g for g in G if g["status"] == "Cancelled"]; susp = [g for g in G if g["status"] == "Suspended"]

def pin_of(a): return a.strip()[-6:]
def proprietor(g): return g["legal_name"].split(" (Prop.")[0] if "(Prop." in g["legal_name"] else "Rahul Verma"
def city(g): return g["principal_place_of_business"].split(",")[-2].strip()

manifest = []
def applicant(cid, g, expect, note, mut=None):
    m = dict(gstin=g["gstin"], legal=g["legal_name"], trade=g["trade_name"], const=g["constitution"], addr=g["principal_place_of_business"],
             dol=g["registration_date"], sig_name=proprietor(g), desig="Proprietor" if g["constitution"] == "Proprietorship" else "Director",
             sig_biz=g["trade_name"], valid="2028-03-31", bill_name=g["trade_name"], bill_addr=g["principal_place_of_business"], bill_date="2026-06-28", udyam=umap.get(g["trade_name"].lower()))
    if mut: mut(m)
    docs = {"gst": gst_doc(m["gstin"], m["legal"], m["trade"], m["const"], m["addr"], m["dol"]),
            "signatory": sig_doc(m["sig_name"], m["desig"], m["sig_biz"], m["valid"]),
            "addressProof": bill_doc(m["bill_name"], m["bill_addr"], m["bill_date"])}
    u = m["udyam"]
    if u: docs["udyam"] = udyam_doc(u["udyam_number"], m.get("u_name", u["enterprise_name"]), u["major_activity"], u["city"], u["state"], u["date_of_registration"])
    paths = {}
    for k, im in docs.items():
        p = f"{OUT}/{cid}_{k}.png"; im.save(p, optimize=True); paths[k] = p
    manifest.append(dict(id=cid, expect=expect, note=note, docs=paths, declared=m["gstin"] if m.get("declare", True) else None))
    return paths

# --- genuine businesses (should pass) ---
for i, g in enumerate(prop[:14]): applicant(f"S{i+1:02d}", g, ["PASS"], f"genuine proprietorship ({g['trade_name']}, {city(g)})")
for i, g in enumerate(pvt[:6]): applicant(f"S{i+15:02d}", g, ["PASS_WITH_WARNINGS"], f"genuine {g['constitution']} — needs authorisation e-sign")
# --- fraud / problem cases ---
def tamper_digit(m):  # change one digit inside the PAN number part, keep old checksum -> checksum fails
    s = list(m["gstin"]); s[8] = str((int(s[8]) + 3) % 10); m["gstin"] = "".join(s)
def digit_in_letter(m):
    s = list(m["gstin"]); s[4] = "0"; m["gstin"] = "".join(s)
def valid_but_absent(m):
    f = m["gstin"][:2] + "ZZZZZ" + m["gstin"][7:13]; m["gstin"] = f + check(f)
def other_name(m): m["legal"] = "Ramesh Gupta (Prop. " + m["trade"] + ")"
def not_prop(m): m["sig_name"] = "Vikram Singh"; m["desig"] = "Manager"
def old_bill(m): m["bill_date"] = "2026-02-10"
def future_bill(m): m["bill_date"] = "2026-09-30"
def other_pin(m): m["bill_addr"] = m["bill_addr"][:-6] + ("110001" if not m["bill_addr"].endswith("110001") else "560001")
def expired(m): m["valid"] = "2025-12-31"
def other_biz(m): m["sig_biz"] = "Shree Ganesh Traders"
def wrong_state(m):  # valid checksum, state code changed -> not in registry
    f = ("27" if m["gstin"][:2] != "27" else "29") + m["gstin"][2:14]; m["gstin"] = f + check(f)
def udyam_other(m):
    m["u_name"] = "Shree Ganesh Traders"
base = prop[20:]
cases = [("F01", canc[0], ["REJECT"], "GSTIN cancelled in registry", None),
         ("F02", canc[1], ["REJECT"], "GSTIN cancelled in registry", None),
         ("F03", susp[0], ["REJECT"], "GSTIN suspended", None),
         ("F04", base[0], ["REJECT"], "one GSTIN digit altered (check digit fails)", tamper_digit),
         ("F05", base[1], ["REJECT"], "digit 0 printed in a PAN letter slot", digit_in_letter),
         ("F06", base[2], ["REJECT"], "well-formed GSTIN not in registry", valid_but_absent),
         ("F07", base[3], ["MANUAL_REVIEW"], "legal name differs from registry", other_name),
         ("F08", base[4], ["MANUAL_REVIEW"], "signatory is not the proprietor", not_prop),
         ("F09", base[5], ["REJECT"], "electricity bill 155 days old", old_bill),
         ("F10", base[6], ["MANUAL_REVIEW"], "bill dated in the future", future_bill),
         ("F11", base[7], ["MANUAL_REVIEW"], "bill PIN differs from registered address", other_pin),
         ("F12", base[8], ["NEEDS_REUPLOAD"], "signatory ID expired", expired),
         ("F13", base[9], ["MANUAL_REVIEW"], "signatory ID for another business", other_biz),
         ("F14", base[10], ["REJECT"], "state code swapped (valid check digit, not in registry)", wrong_state),
         ]
for cid, g, exp, note, mut in cases: applicant(cid, g, exp, note, mut)
# udyam name mismatch needs a business with a udyam record
ug = next(g for g in base[11:] if umap.get(g["trade_name"].lower()))
applicant("F15", ug, ["MANUAL_REVIEW"], "Udyam certificate shows another enterprise name", udyam_other)
json.dump(manifest, open("scripts/kyc-stress/out/applicants.json", "w"), indent=1)
print(len(manifest), "applicants;", sum(len(m["docs"]) for m in manifest), "images")
