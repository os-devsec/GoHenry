function normalizeLocation(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function specialZone(value = '') {
  const normalized = normalizeLocation(value);
  if (normalized.includes('gastronomia') || normalized.includes('automotriz')) return 'automotriz_gastronomia';
  if (normalized.includes('deportes')) return 'deportes';
  return null;
}

export function calculateDeliveryFee(origin = '', destination = '') {
  const originZone = specialZone(origin);
  const destinationZone = specialZone(destination);

  if (originZone && destinationZone && originZone !== destinationZone) return 1.5;
  if (!originZone && destinationZone) return 1;
  return 0.5;
}
