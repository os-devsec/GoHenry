export function customerErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  if (
    message.includes('stock')
    || message.includes('unidades disponibles')
    || message.includes('tienda esta cerrada')
    || message.includes('fuera de su horario')
    || message.includes('tienda no esta disponible')
  ) {
    return message;
  }
  return fallback;
}
