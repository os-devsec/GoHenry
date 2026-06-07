const SPECIAL_ZONE_PATTERN = /automotriz|gastronomia/i;

export function isSpecialDeliveryZone(value?: string) {
  return SPECIAL_ZONE_PATTERN.test(value || '');
}

export function calculateDeliveryFee(storeLocation?: string, deliveryLocation?: string) {
  const storeIsSpecial = isSpecialDeliveryZone(storeLocation);
  const deliveryIsSpecial = isSpecialDeliveryZone(deliveryLocation);
  return storeIsSpecial && !deliveryIsSpecial ? 1 : 0.5;
}
