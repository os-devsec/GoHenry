export function customerErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();
  if (
    normalized.includes('stock')
    || normalized.includes('unidades disponibles')
    || normalized.includes('tienda esta cerrada')
    || normalized.includes('fuera de su horario')
    || normalized.includes('tienda no esta disponible')
  ) {
    return message;
  }
  return fallback;
}
