export function whatsappPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('593') && digits.length >= 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `593${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('9')) return `593${digits}`;
  return digits;
}

export function whatsappUrl(phone, message) {
  const normalizedPhone = whatsappPhone(phone);
  return normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
    : '#';
}
