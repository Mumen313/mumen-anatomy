# Removes printed labels from a public-domain plate (inpainting) so it can be used for pin tests.
# Usage: python3 clean_plate.py spec.json in.png out.png [preview.png]
import sys, json, cv2, numpy as np
spec = json.load(open(sys.argv[1]))
img = cv2.imread(sys.argv[2], cv2.IMREAD_COLOR)
mask = np.zeros(img.shape[:2], np.uint8)
for m in spec['masks']:
    if len(m) == 4 and not isinstance(m[0], list):
        x0, y0, x1, y1 = m
        cv2.rectangle(mask, (x0, y0), (x1, y1), 255, -1)
    else:
        cv2.fillPoly(mask, [np.array(m, np.int32)], 255)
for w in spec.get('white', []):  # areas on white background: just paint white
    x0, y0, x1, y1 = w
    img[y0:y1, x0:x1] = 255
    mask[y0:y1, x0:x1] = 0
out = cv2.inpaint(img, mask, 6, cv2.INPAINT_TELEA)
cv2.imwrite(sys.argv[3], out)
if len(sys.argv) > 4:
    prev = out.copy()
    for p in spec.get('pins', []):
        cv2.circle(prev, (p['x'], p['y']), 7, (30, 30, 200), -1)
        cv2.putText(prev, str(p['n']), (p['x'] + 8, p['y'] + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 0, 0), 1)
    cv2.imwrite(sys.argv[4], prev)
