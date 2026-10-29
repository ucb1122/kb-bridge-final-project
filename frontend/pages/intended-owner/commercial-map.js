/** Kakao map and layer helpers for the recovery planner. */
const kakaoMaps = () => {
  const maps = window.kakao?.maps;
  if (!maps?.Map) throw new Error('카카오 지도를 불러오지 못했습니다. 지도 API 키를 확인해 주세요.');
  return maps;
};

export function createLayerGroup(map) {
  const layers = [];
  return {
    add(layer) { layers.push(layer); layer.setMap(map); return layer; },
    clearLayers() { for (const layer of layers) layer.setMap(null); layers.length = 0; },
    getBounds() {
      const bounds = new (kakaoMaps().LatLngBounds)();
      let count = 0;
      for (const layer of layers) for (const point of layer.regionPoints || []) {
        bounds.extend(point); count++;
      }
      return count ? bounds : null;
    },
  };
}

export function drawFeature(group, feature, style, onClick) {
  const maps = kakaoMaps();
  const polygons = feature.geometry?.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry?.type === 'MultiPolygon' ? feature.geometry.coordinates : [];
  for (const rings of polygons) {
    const paths = rings.map(ring => ring.map(([lng, lat]) => new maps.LatLng(lat, lng)));
    if (!paths[0]?.length) continue;
    const polygon = new maps.Polygon({
      path: paths.length === 1 ? paths[0] : paths,
      strokeWeight: style.weight ?? 1,
      strokeColor: style.color ?? '#8b98a6',
      strokeOpacity: style.opacity ?? 1,
      strokeStyle: style.dashArray ? 'shortdash' : 'solid',
      fillColor: style.fillColor ?? '#b9c2cc',
      fillOpacity: style.fillOpacity ?? 0,
      zIndex: style.zIndex ?? 1,
    });
    polygon.regionPoints = paths.flat();
    group.add(polygon);
    if (onClick) maps.event.addListener(polygon, 'click', () => {
      maps.event.preventMap?.();
      onClick();
    });
  }
}

export function createMap(id = 'map') {
  const maps = kakaoMaps();
  const nativeMap = new maps.Map(document.getElementById(id), {
    center: new maps.LatLng(37.5665, 126.978), level: 7,
  });
  nativeMap.addControl(new maps.ZoomControl(), maps.ControlPosition.BOTTOMRIGHT);
  const pins = createLayerGroup(nativeMap);
  const map = {
    nativeMap,
    setView([lat, lng], zoom = 12) {
      nativeMap.setCenter(new maps.LatLng(lat, lng));
      nativeMap.setLevel(Math.max(1, Math.round(18 - zoom)));
    },
    fitBounds(bounds, { maxZoom } = {}) {
      if (!bounds) return;
      nativeMap.setBounds(bounds);
      if (maxZoom && nativeMap.getLevel() < Math.round(18 - maxZoom)) nativeMap.setLevel(Math.round(18 - maxZoom));
    },
    on(name, callback) {
      maps.event.addListener(nativeMap, name, event => {
        if (name === 'click') callback({ latlng: { lat: event.latLng.getLat(), lng: event.latLng.getLng() } });
        else callback(event);
      });
    },
    invalidateSize() { nativeMap.relayout(); },
  };
  return {
    map,
    show(points) {
      pins.clearLayers();
      for (const point of points) {
        if (!Number.isFinite(+point.lat) || !Number.isFinite(+point.lng)) continue;
        const content = document.createElement('div');
        content.className = 'region-map-pin';
        const dot = document.createElement('span');
        dot.className = 'region-pin-dot';
        const label = document.createElement('strong');
        label.className = 'region-pin-label';
        label.textContent = point.name || '선택 지역';
        content.append(dot, label);
        pins.add(new maps.CustomOverlay({ position: new maps.LatLng(+point.lat, +point.lng), content, yAnchor: 0, zIndex: 10 }));
      }
    },
    focus(lat, lng) { map.setView([lat, lng], 14); },
  };
}
