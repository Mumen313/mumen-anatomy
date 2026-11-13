# Removes printed labels from a public-domain plate so it can be used for pin tests.
#   auto_margin: everything outside the drawing (labels, leader lines in the white margin) -> white
#   whiten:  rectangles painted white
#   text:    rectangles/polygons over labels on the figure -> only dark letter strokes are inpainted
#   keep:    rectangles that auto_margin must not erase
# Coordinates are given at 1/scale of the source (spec["scale"]).
# Usage: python3 clean_plate.py spec.json in.jpg out.jpg [max_width]
import sys, json, cv2, numpy as np
spec = json.load(open(sys.argv[1]))
S = spec.get('scale', 1)
img = cv2.imread(sys.argv[2], cv2.IMREAD_COLOR)
H, W = img.shape[:2]
sc = lambda v: int(round(v * S))

def rect_or_poly(mask, m, val=255):
    if not isinstance(m[0], list):
        cv2.rectangle(mask, (sc(m[0]), sc(m[1])), (sc(m[2]), sc(m[3])), val, -1)
    else:
        cv2.fillPoly(mask, [np.array([[sc(p[0]), sc(p[1])] for p in m], np.int32)], val)

out = img.copy()
# 1) labels on the figure: inpaint dark strokes only
area = np.zeros((H, W), np.uint8)
for m in spec.get('text', []):
    rect_or_poly(area, m)
if area.any():
    thr = spec.get('dark', 150)
    mx = img.max(axis=2); mn = img.min(axis=2)
    dark = ((mx < thr) & ((mx.astype(int) - mn) < spec.get('sat', 90))).astype(np.uint8) * 255
    mask = cv2.dilate(cv2.bitwise_and(dark, area), np.ones((3, 3), np.uint8), iterations=spec.get('grow', 3))
    out = cv2.inpaint(out, mask, 5, cv2.INPAINT_TELEA)
# 2) margin: keep only the big drawing body
if spec.get('auto_margin'):
    ink = (img.min(axis=2) < spec.get('white', 225)).astype(np.uint8) * 255
    k = spec.get('open', 15)
    body = cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(body, 8)
    keep = np.zeros_like(body)
    minarea = spec.get('min_area', 0.01) * H * W
    for c in range(1, n):
        if stats[c, cv2.CC_STAT_AREA] >= minarea:
            keep[lab == c] = 255
    # fill holes
    cnts, _ = cv2.findContours(keep, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    keep = np.zeros_like(keep)
    cv2.drawContours(keep, cnts, -1, 255, -1)
    keep = cv2.dilate(keep, np.ones((3, 3), np.uint8), iterations=spec.get('pad', 4))
    for m in spec.get('keep', []):
        rect_or_poly(keep, m)
    for m in spec.get('drop', []):
        rect_or_poly(keep, m, 0)
    out[keep == 0] = 255
for w in spec.get('whiten', []):
    m = np.zeros((H, W), np.uint8); rect_or_poly(m, w); out[m > 0] = 255
if 'crop' in spec:
    x0, y0, x1, y1 = [sc(v) for v in spec['crop']]
    out = out[y0:y1, x0:x1]
mw = int(sys.argv[4]) if len(sys.argv) > 4 else 1400
if out.shape[1] > mw:
    out = cv2.resize(out, (mw, int(out.shape[0] * mw / out.shape[1])), interpolation=cv2.INTER_AREA)
cv2.imwrite(sys.argv[3], out, [cv2.IMWRITE_JPEG_QUALITY, 85])
print(sys.argv[3], out.shape[1], out.shape[0])
