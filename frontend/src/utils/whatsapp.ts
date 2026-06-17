export function whatsappPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00593')) return digits.slice(2);
  if (digits.startsWith('5930')) return `593${digits.slice(4)}`;
  if (digits.startsWith('593') && digits.length >= 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `593${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('9')) return `593${digits}`;
  return digits;
}

export function whatsappUrl(phone, message) {
  const normalizedPhone = whatsappPhone(phone);
  if (!normalizedPhone) return '#';

  const params = new URLSearchParams({ phone: normalizedPhone });
  if (message) {
    params.set('text', message);
  }
  return `https://api.whatsapp.com/send?${params.toString()}`;
}
