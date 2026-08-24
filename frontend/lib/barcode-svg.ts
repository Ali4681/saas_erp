const EAN_L = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011",
];
const EAN_G = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111",
];
const EAN_R = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100",
];
const EAN_PARITY = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL",
];

const CODE128 = [
  "11011001100","11001101100","11001100110","10010011000","10010001100",
  "10001001100","10011001000","10011000100","10001100100","11001001000",
  "11001000100","11000100100","10110011100","10011011100","10011001110",
  "10111001100","10011101100","10011100110","11001110010","11001011100",
  "11001001110","11011100100","11001110100","11101101110","11101001100",
  "11100101100","11100100110","11101100100","11100110100","11100110010",
  "11011011000","11011000110","11000110110","10100011000","10001011000",
  "10001000110","10110001000","10001101000","10001100010","11010001000",
  "11000101000","11000100010","10110111000","10110001110","10001101110",
  "10111011000","10111000110","10001110110","11101110110","11010001110",
  "11000101110","11011101000","11011100010","11011101110","11101011000",
  "11101000110","11100010110","11101101000","11101100010","11100011010",
  "11101111010","11001000010","11110001010","10100110000","10100001100",
  "10010110000","10010000110","10000101100","10000100110","10110010000",
  "10110000100","10011010000","10011000100","10000110100","10000110010",
  "11010010000","11010000100","11010001000","11000100010","11000100100",
  "11101010000","11101000100","11100010100","11100010010","11100100010",
  "11100001010","11100000110","11010000100","11010000010","11000010010",
  "11101010010","11011101110","11101011100","11100010100","11100010010",
  "11100101000","11100100010","11100001000","11100000100","11010111000",
  "11010001100","11010000110","11000101100","11000100110","11101011010",
  "1100011101011",
];

function bitsToSvg(
  bits: string,
  text: string,
  height = 56,
  module = 1.5,
  quiet = 10,
  fontSize = 12,
) {
  const width = bits.length * module + quiet * 2;
  const bars: string[] = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === "1") {
      bars.push(
        `<rect x="${(quiet + i * module).toFixed(2)}" y="0" width="${module}" height="${height}" fill="#111"/>`,
      );
    }
  }
  const textY = height + fontSize + 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${textY + 2}" viewBox="0 0 ${width} ${textY + 2}" role="img" aria-label="${escapeXml(text)}">${bars.join("")}<text x="${(width / 2).toFixed(2)}" y="${textY}" text-anchor="middle" font-size="${fontSize}" font-family="ui-monospace, Consolas, monospace">${escapeXml(text)}</text></svg>`;
}

function ean13Bits(code: string) {
  const first = Number(code[0]);
  const parity = EAN_PARITY[first] ?? EAN_PARITY[0];
  let bits = "101";
  for (let i = 0; i < 6; i++) {
    const d = Number(code[i + 1]);
    bits += (parity[i] === "G" ? EAN_G : EAN_L)[d];
  }
  bits += "01010";
  for (let i = 7; i < 13; i++) bits += EAN_R[Number(code[i])];
  return `${bits}101`;
}

function code128Bits(text: string) {
  const codes = [104];
  for (const ch of text) {
    const v = ch.charCodeAt(0) - 32;
    codes.push(v >= 0 && v <= 94 ? v : 16);
  }
  let checksum = 104;
  for (let i = 1; i < codes.length; i++) checksum += codes[i] * i;
  codes.push(checksum % 103, 106);
  return codes.map((c) => CODE128[Math.min(c, CODE128.length - 1)]).join("") + "11";
}

export function barcodeToSvg(
  value: string,
  height = 56,
  module = 1.5,
  quiet = 10,
  fontSize = 12,
): string {
  const text = value.trim() || "0";
  const bits = /^\d{13}$/.test(text) ? ean13Bits(text) : code128Bits(text);
  return bitsToSvg(bits, text, height, module, quiet, fontSize);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function printBarcodeLabels(input: {
  title: string;
  sku?: string | null;
  barcode: string;
  copies: number;
}) {
  const copies = Math.min(50, Math.max(1, input.copies || 1));
  const svg = barcodeToSvg(input.barcode, 28, 1.05, 4, 8);
  const card = `
    <div class="label">
      <div class="name">${escapeXml(input.title)}</div>
      ${input.sku ? `<div class="sku">${escapeXml(input.sku)}</div>` : ""}
      <div class="bars">${svg}</div>
    </div>`;
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>ملصق ${escapeXml(input.barcode)}</title>
  <style>
    @page { size: 50mm 30mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: Tahoma, Arial, sans-serif;
      background: #1f2937;
      color: #111;
      min-height: 100vh;
    }
    .screen {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 32px 16px;
    }
    .toolbar {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .toolbar button {
      min-width: 140px;
      height: 44px;
      border: 0;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
    }
    .print-btn { background: #2563eb; color: #fff; }
    .close-btn { background: #e5e7eb; color: #111; }
    .hint { color: #e5e7eb; font-size: 14px; }
    .stage {
      background: #fff;
      width: 680px;
      height: 430px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 16px;
      box-shadow: 0 20px 50px rgba(0,0,0,.35);
    }
    .zoom {
      transform: scale(3.4);
      transform-origin: center center;
      width: 50mm;
      height: 30mm;
    }
    .label {
      width: 50mm;
      height: 30mm;
      padding: 1.5mm 2mm 1mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      overflow: hidden;
      border: 1px dashed #d1d5db;
    }
    .name {
      font-size: 8px;
      font-weight: 700;
      line-height: 1.15;
      max-height: 10px;
      overflow: hidden;
      width: 100%;
    }
    .sku { font-size: 6.5px; color: #333; margin-top: 0.4mm; }
    .bars { margin-top: 0.8mm; width: 100%; }
    .bars svg { width: 46mm; height: 16mm; }
    .print-pack { display: none; }
    @media print {
      html, body { background: #fff; width: 50mm; min-height: 30mm; }
      .screen { display: none !important; }
      .print-pack { display: block; }
      .print-pack .label {
        border: 0;
        page-break-after: always;
        break-after: page;
      }
    }
  </style>
</head>
<body>
  <div class="screen">
    <div class="toolbar">
      <button class="print-btn" type="button" onclick="window.print()">طباعة الملصق</button>
      <button class="close-btn" type="button" onclick="window.close()">إغلاق</button>
    </div>
    <p class="hint">معاينة مكبرة — عند الطباعة يُرسل الملصق بمقاس 50×30 مم</p>
    <div class="stage"><div class="zoom">${card}</div></div>
  </div>
  <div class="print-pack">${card.repeat(copies)}</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "_blank", "width=920,height=780,scrollbars=yes,resizable=yes");
  if (popup) {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", input.barcode);
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;";
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.addEventListener(
      "focus",
      () => {
        iframe.remove();
        URL.revokeObjectURL(url);
      },
      { once: true },
    );
  };
}
