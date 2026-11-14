# Cleans a dissection photo for the cadaver clip test: erases white label stickers / handwriting,
# coloured outline drawings, and blurs faces. Never published: the source photo.
# spec: {"stickers":true, "erase":[[x0,y0,x1,y1],...], "blur":[[x0,y0,x1,y1]], "colors":["blue"], "crop":[...]}
import sys, json, cv2, numpy as np
spec = json.load(open(sys.argv[1])); img = cv2.imread(sys.argv[2]); H, W = img.shape[:2]
mask = np.zeros((H, W), np.uint8)
if spec.get('stickers'):
    mn = img.min(axis=2).astype(int); mx = img.max(axis=2).astype(int)
    white = ((mn > spec.get('wmin', 200)) & (mx - mn < spec.get('wsat', 30))).astype(np.uint8) * 255
    white = cv2.morphologyEx(white, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(white, 8)
    for c in range(1, n):
        a = st[c, cv2.CC_STAT_AREA]; w = st[c, cv2.CC_STAT_WIDTH]; h = st[c, cv2.CC_STAT_HEIGHT]
        if spec.get('amin', 1500) <= a <= spec.get('amax', 120000) and max(w, h) < W * 0.5:
            comp = (lab == c).astype(np.uint8) * 255
            cnts, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            hull = cv2.convexHull(np.vstack(cnts)); cv2.fillPoly(mask, [hull], 255)
    for k in spec.get('keep', []):
        x0, y0, x1, y1 = k; mask[y0:y1, x0:x1] = 0
for e in spec.get('erase', []):
    if isinstance(e[0], list): cv2.fillPoly(mask, [np.array(e, np.int32)], 255)
    else: cv2.rectangle(mask, (e[0], e[1]), (e[2], e[3]), 255, -1)
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
for col in spec.get('colors', []):
    rng = {'blue': ((95, 120, 80), (130, 255, 255)), 'red': ((0, 140, 120), (8, 255, 255)), 'yellow': ((20, 120, 150), (35, 255, 255)),
           'orange': ((10, 140, 150), (20, 255, 255)), 'green': ((36, 80, 80), (80, 255, 255)), 'black': ((0, 0, 0), (180, 255, 40))}[col]
    m = cv2.inRange(hsv, np.array(rng[0]), np.array(rng[1]))
    for r in spec.get('color_area', [[0, 0, W, H]]):
        sub = np.zeros_like(m); sub[r[1]:r[3], r[0]:r[2]] = m[r[1]:r[3], r[0]:r[2]]; mask |= sub
mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=spec.get('grow', 3))
out = cv2.inpaint(img, mask, 9, cv2.INPAINT_TELEA)
for b in spec.get('blur', []):
    x0, y0, x1, y1 = b; roi = out[y0:y1, x0:x1]
    small = cv2.resize(roi, (max(1, (x1 - x0) // 24), max(1, (y1 - y0) // 24)), interpolation=cv2.INTER_AREA)
    out[y0:y1, x0:x1] = cv2.GaussianBlur(cv2.resize(small, (x1 - x0, y1 - y0), interpolation=cv2.INTER_NEAREST), (31, 31), 0)
if 'crop' in spec:
    x0, y0, x1, y1 = spec['crop']; out = out[y0:y1, x0:x1]
mw = int(sys.argv[4]) if len(sys.argv) > 4 else 1600
if out.shape[1] > mw: out = cv2.resize(out, (mw, int(out.shape[0] * mw / out.shape[1])), interpolation=cv2.INTER_AREA)
cv2.imwrite(sys.argv[3], out, [cv2.IMWRITE_JPEG_QUALITY, 88])
print(sys.argv[3], out.shape[1], out.shape[0], 'masked px', int((mask > 0).sum()))
