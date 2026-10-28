"""Derive Seoul district outlines from the local administrative-dong GeoJSON."""

import json
from collections import Counter, defaultdict
from pathlib import Path

root = Path(__file__).resolve().parents[2]
source = root / "data" / "commerce-dong.geojson"
target = root / "frontend" / "pages" / "rising" / "district-boundaries.geojson"
features = json.loads(source.read_text(encoding="utf-8"))["features"]
districts = sorted({feature["properties"]["district"] for feature in features})
result = []

for district in districts:
    edges = Counter()
    for feature in features:
        if feature["properties"]["district"] != district:
            continue
        geometry = feature["geometry"]
        polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
        for polygon in polygons:
            for ring in polygon:
                for start, end in zip(ring, ring[1:]):
                    edges[tuple(sorted((tuple(start), tuple(end))))] += 1

    neighbors = defaultdict(list)
    for (start, end), count in edges.items():
        if count == 1:
            neighbors[start].append(end)
            neighbors[end].append(start)
    if any(len(ends) != 2 for ends in neighbors.values()):
        raise ValueError(f"{district}: outer boundary does not form closed rings")

    unused = {edge for edge, count in edges.items() if count == 1}
    rings = []
    while unused:
        start, current = next(iter(unused))
        ring = [start, current]
        unused.remove(tuple(sorted((start, current))))
        while current != start:
            candidates = [point for point in neighbors[current] if tuple(sorted((current, point))) in unused]
            if not candidates:
                raise ValueError(f"{district}: open district boundary")
            next_point = candidates[0]
            unused.remove(tuple(sorted((current, next_point))))
            ring.append(next_point)
            current = next_point
        if len(ring) >= 4:
            rings.append([list(point) for point in ring])
    geometry = {"type": "MultiLineString", "coordinates": rings}
    result.append({"type": "Feature", "properties": {"district": district}, "geometry": geometry})

target.write_text(json.dumps({"type": "FeatureCollection", "features": result}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Wrote {len(result)} district outlines to {target}")
