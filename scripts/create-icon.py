"""Draw the native Athan mark using only the Python standard library."""
import math
import struct
import zlib
from pathlib import Path

size, scale = 256, 2
star = [(24, 8), (29, 16), (38, 14), (36, 23), (41, 29), (32, 32), (29, 41), (23, 36), (14, 38), (16, 29), (8, 24), (16, 19), (14, 10), (23, 12)]
diamond = [(24, 16), (32, 24), (24, 32), (16, 24)]

def segment_distance(x, y, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0, min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)

def pixel(x, y):
    if math.hypot(max(0, abs(x - 24) - 10), max(0, abs(y - 24) - 10)) > 14:
        return (0, 0, 0, 0)
    if math.hypot(x - 24, y - 24) <= 2.5:
        return (219, 188, 126, 255)
    for points in (star, diamond):
        for a, b in zip(points, points[1:] + points[:1]):
            if segment_distance(x, y, a, b) <= 0.65:
                return (244, 239, 217, 255)
    return (54, 93, 72, 255)

rows = []
for y in range(size):
    row = bytearray([0])
    for x in range(size):
        samples = [pixel((x + (sx + .5) / scale) * 48 / size, (y + (sy + .5) / scale) * 48 / size) for sy in range(scale) for sx in range(scale)]
        row.extend(round(sum(s[c] for s in samples) / len(samples)) for c in range(4))
    rows.append(row)

def chunk(kind, data):
    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))

output = Path(__file__).resolve().parent.parent / 'assets' / 'icon.png'
output.parent.mkdir(exist_ok=True)
output.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows))) + chunk(b'IEND', b''))
png = output.read_bytes()
output.with_suffix('.ico').write_bytes(struct.pack('<HHH', 0, 1, 1) + struct.pack('<BBBBHHII', 0, 0, 0, 0, 1, 32, len(png), 22) + png)
print(output)
