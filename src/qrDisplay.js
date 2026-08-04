const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const QRCode = require('qrcode');
const knowledge = require('./companyKnowledge');

const QR_FILE = path.join(process.cwd(), 'whatsapp-qr.png');

async function displayQr(qr) {
  await QRCode.toFile(QR_FILE, qr, {
    type: 'png',
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  console.log(`\n📱 Scan the QR code with WhatsApp on phone ${knowledge.whatsappNumber}:\n`);
  console.log(`   QR saved to: ${QR_FILE}`);
  console.log('   Opening QR image now...\n');
  console.log('   On phone: WhatsApp → Linked Devices → Link a Device → Scan QR\n');

  try {
    if (process.platform === 'win32') {
      execSync(`start "" "${QR_FILE}"`, { stdio: 'ignore', shell: true });
    } else if (process.platform === 'darwin') {
      execSync(`open "${QR_FILE}"`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open "${QR_FILE}"`, { stdio: 'ignore' });
    }
  } catch {
    console.log('   Could not auto-open the image — open whatsapp-qr.png manually.\n');
  }
}

function removeQrFile() {
  try {
    if (fs.existsSync(QR_FILE)) fs.unlinkSync(QR_FILE);
  } catch {
    // ignore
  }
}

module.exports = { displayQr, removeQrFile, QR_FILE };
