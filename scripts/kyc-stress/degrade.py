import json, io, os, random, numpy as np, cv2
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw
random.seed(3); np.random.seed(3)
OUT="scripts/kyc-stress/out/variants"; os.makedirs(OUT, exist_ok=True)
apps = json.load(open("scripts/kyc-stress/out/applicants.json"))
KEY = {"K01":["REJECT"],"K02":["REJECT"],"K03":["PASS"],"K04":["NEEDS_REUPLOAD"],"K05":["PASS_WITH_WARNINGS"],"K06":["REJECT"],"K07":["MANUAL_REVIEW"],"K08":["REJECT"],"K09":["PASS"],"K10":["PASS_WITH_WARNINGS"],"K11":["REJECT"],"K12":["PASS"]}
GST = {"K12":"37NBLXS1145E1ZU"}
D="data/kyc_documents"; names={"gst":"gst_certificate","udyam":"udyam_certificate","signatory":"signatory_id","addressProof":"address_proof"}
for k,e in KEY.items():
    docs={s:f"{D}/{k}_{n}.png" for s,n in names.items() if os.path.exists(f"{D}/{k}_{n}.png")}
    apps.append(dict(id=k, expect=e, note="case sample", docs=docs, declared=None))

def rot(im, deg):
    return im.convert("RGB").rotate(-deg, expand=True, fillcolor=(255,255,255), resample=Image.BICUBIC)
def phone(im):
    a = np.array(im.convert("RGB")); h, w = a.shape[:2]
    W, H = int(w*1.35), int(h*1.25)
    bg = np.full((H, W, 3), (92, 74, 58), np.uint8)  # wooden table
    bg = cv2.add(bg, (np.random.randn(H, W, 1)*12).astype(np.int8).repeat(3,2), dtype=cv2.CV_8U)
    src = np.float32([[0,0],[w,0],[w,h],[0,h]]); j = lambda: random.uniform(-0.04,0.04)
    ox, oy = (W-w)/2, (H-h)/2
    dst = np.float32([[ox+w*j(),oy+h*j()],[ox+w+w*j(),oy+h*j()],[ox+w+w*j(),oy+h+h*j()],[ox+w*j(),oy+h+h*j()]])
    M = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(a, M, (W, H), borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    mask = cv2.warpPerspective(np.full((h,w),255,np.uint8), M, (W,H))
    out = np.where(mask[...,None]>0, warped, bg)
    grad = np.linspace(0.75, 1.05, W)[None,:,None]  # shadow from one side
    out = np.clip(out*grad, 0, 255).astype(np.uint8)
    out = cv2.GaussianBlur(out, (3,3), 0.8)
    im2 = Image.fromarray(out).resize((W*3//4, H*3//4))
    return im2
def screen_photo(im):
    a = np.array(im.convert("RGB").resize((im.width, im.height))).astype(np.float32)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    moire = (np.sin(xx*0.9+yy*0.35)*10)[...,None]
    a = np.clip(a*0.92 + moire + 8, 0, 255).astype(np.uint8)
    return Image.fromarray(a).filter(ImageFilter.GaussianBlur(0.7))
def screenshot(im):
    canvas = Image.new("RGB", (1920, 1080), (40, 44, 52)); d = ImageDraw.Draw(canvas)
    d.rectangle([0,0,1920,60], fill=(230,230,230)); d.rectangle([0,60,300,1080], fill=(60,64,72))
    s = im.convert("RGB"); s.thumbnail((1500, 1000)); canvas.paste(s, (300 + (1620-s.width)//2, 70)); return canvas
def noise(im):
    a = np.array(im.convert("RGB")).astype(np.int16); a += (np.random.randn(*a.shape)*18).astype(np.int16)
    return Image.fromarray(np.clip(a,0,255).astype(np.uint8))
def crop_top(im):  # only the top 45%: GSTIN, names, address visible; bill date maybe cut
    return im.crop((0, 0, im.width, int(im.height*0.45)))
def pen_mark(im):  # someone scribbles a tick + circles the GSTIN with a pen
    im = im.convert("RGB").copy(); d = ImageDraw.Draw(im)
    d.ellipse([500, 240, 800, 300], outline=(20, 40, 160), width=4); d.line([(900,700),(940,740),(1020,640)], fill=(20,40,160), width=6); return im

T = {
 "jpeg25": lambda im: ("jpg", im.convert("RGB"), dict(quality=25)),
 "half": lambda im: ("png", im.resize((im.width//2, im.height//2)), {}),
 "third": lambda im: ("png", im.resize((im.width//3, im.height//3)), {}),
 "up2x": lambda im: ("jpg", im.convert("RGB").resize((im.width*2, im.height*2), Image.BICUBIC), dict(quality=80)),
 "rot4": lambda im: ("png", rot(im, 4), {}),
 "rot9": lambda im: ("png", rot(im, -9), {}),
 "rot14": lambda im: ("png", rot(im, 14), {}),
 "rot25": lambda im: ("png", rot(im, 25), {}),
 "rot90": lambda im: ("png", im.convert("RGB").rotate(90, expand=True), {}),
 "rot180": lambda im: ("png", im.convert("RGB").rotate(180), {}),
 "blur1": lambda im: ("png", im.filter(ImageFilter.GaussianBlur(1.2)), {}),
 "blur3": lambda im: ("png", im.filter(ImageFilter.GaussianBlur(3)), {}),
 "dark": lambda im: ("jpg", ImageEnhance.Brightness(im.convert("RGB")).enhance(0.45), dict(quality=80)),
 "bright": lambda im: ("jpg", ImageEnhance.Brightness(im.convert("RGB")).enhance(1.5), dict(quality=80)),
 "lowcontrast": lambda im: ("png", ImageEnhance.Contrast(im.convert("RGB")).enhance(0.35), {}),
 "noise": lambda im: ("jpg", noise(im), dict(quality=85)),
 "gray": lambda im: ("png", im.convert("L"), {}),
 "phone": lambda im: ("jpg", phone(im), dict(quality=78)),
 "screen": lambda im: ("jpg", screen_photo(im), dict(quality=80)),
 "screenshot": lambda im: ("png", screenshot(im), {}),
 "croptop": lambda im: ("png", crop_top(im), {}),
 "pen": lambda im: ("png", pen_mark(im), {}),
 "webp": lambda im: ("webp", im.convert("RGB"), dict(quality=70)),
 "alpha": lambda im: ("png", im.convert("RGBA"), {}),
 "cmyk": lambda im: ("jpg", im.convert("CMYK"), dict(quality=90)),
}
pick = [a for a in apps if a["id"] in ("S01","S02","S05","S09","S15","S17","F01","F04","F05","F07","F09","F11","K03","K06","K08","K09","K10","K12","K07","K02")]
cases = [dict(a, variant="original") for a in apps]
for a in pick:
    for name, fn in T.items():
        docs = {}
        for slot, p in a["docs"].items():
            ext, im, kw = fn(Image.open(p))
            out = f"{OUT}/{a['id']}_{name}_{slot}.{ext}"; im.save(out, **kw); docs[slot] = out
        cases.append(dict(a, variant=name, docs=docs))
# EXIF-rotated phone JPEG: pixels stored sideways, orientation tag says rotate
for a in pick[:6]:
    docs = {}
    for slot, p in a["docs"].items():
        im = Image.open(p).convert("RGB").rotate(90, expand=True); ex = Image.Exif(); ex[0x0112] = 6
        out = f"{OUT}/{a['id']}_exif6_{slot}.jpg"; im.save(out, quality=88, exif=ex); docs[slot] = out
    cases.append(dict(a, variant="exif6", docs=docs))
json.dump(cases, open("scripts/kyc-stress/out/cases.json","w"), indent=1)
print(len(cases), "cases")
