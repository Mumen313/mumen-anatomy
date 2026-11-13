# Removes printed labels from a public-domain plate so it can be used for pin tests.
#   whiten: rectangles on the white margin -> painted white
#   text:   rectangles/polygons over labels on the figure -> only dark letter strokes are inpainted
# Coordinates are given at 1/scale of the source (spec["scale"]).
# Usage: python3 clean_plate.py spec.json in.png out.jpg [max_width]
import sys, json, cv2, numpy as np
spec = json.load(open(sys.argv[1]))
S = spec.get('scale', 1)
img = cv2.imread(sys.argv[2], cv2.IMREAD_COLOR)
H, W = img.shape[:2]
area = np.zeros((H, W), np.uint8)
for m in spec.get('text', []):
    if not isinstance(m[0], list):
        x0, y0, x1, y1 = [int(v * S) for v in m]
        cv2.rectangle(area, (x0, y0), (x1, y1), 255, -1)
    else:
        cv2.fillPoly(area, [np.array([[p[0] * S, p[1] * S] for p in m], np.int32)], 255)
thr = spec.get('dark', 85)
mx = img.max(axis=2)
mn = img.min(axis=2)
dark = ((mx < thr) & ((mx.astype(int) - mn) < spec.get('sat', 60))).astype(np.uint8) * 255
mask = cv2.bitwise_and(dark, area)
mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=spec.get('grow', 2))
out = cv2.inpaint(img, mask, 5, cv2.INPAINT_TELEA)
for w in spec.get('whiten', []):
    x0, y0, x1, y1 = [int(v * S) for v in w]
    out[y0:y1, x0:x1] = 255
if 'crop' in spec:
    x0, y0, x1, y1 = [int(v * S) for v in spec['crop']]
    out = out[y0:y1, x0:x1]
mw = int(sys.argv[4]) if len(sys.argv) > 4 else 1400
if out.shape[1] > mw:
    out = cv2.resize(out, (mw, int(out.shape[0] * mw / out.shape[1])), interpolation=cv2.INTER_AREA)
cv2.imwrite(sys.argv[3], out, [cv2.IMWRITE_JPEG_QUALITY, 84])
print(sys.argv[3], out.shape)
