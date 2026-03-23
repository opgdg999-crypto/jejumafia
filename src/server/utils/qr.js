import QRCode from 'qrcode';

export async function generateQRCode(url) {
  return QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}
