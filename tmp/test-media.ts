const API_URL = 'https://evolution.fazag.edu.br';
const API_KEY = 'b437b682f5f043d0b5a6d896f0f05563';
const INSTANCE = 'b437b682f5f043d0b5a6d896f0f05563';

const messagePayload = {
  "key": {
    "remoteJid": "557582625992@s.whatsapp.net",
    "fromMe": false,
    "id": "ACE92F0D14B6741FBF199164377C88F1"
  },
  "message": {
    "audioMessage": {
      "url": "https://mmg.whatsapp.net/v/t62.7117-24/543029686_1272973024169296_8457389390025761477_n.enc?ccb=11-4&oh=01_Q5Aa4AHR2eVadwOux4nE2qSRMic3LZwNQYu1tpkMI2G--teAUQ&oe=69F0E7C8&_nc_sid=5e03e0&mms3=true",
      "mimetype": "audio/ogg; codecs=opus",
      "seconds": 2,
      "ptt": true
    }
  }
};

async function testDecryption() {
  console.log(`[TEST] Testando descriptografia via Evolution API...`);
  try {
    const response = await fetch(`${API_URL}/chat/getBase64FromMediaMessage/${INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY
      },
      body: JSON.stringify({ message: messagePayload })
    });

    console.log(`[TEST] Status: ${response.status} ${response.statusText}`);
    const data = await response.json();
    
    if (data.base64 || data.response?.base64) {
      const b64 = data.base64 || data.response?.base64;
      console.log(`[TEST] SUCESSO! Base64 recebido (Tamanho: ${b64.length})`);
    } else {
      console.log(`[TEST] FALHA: Resposta não contém base64.`);
      console.log(`[TEST] Resposta completa:`, JSON.stringify(data, null, 2));
    }
  } catch (err: any) {
    console.error(`[TEST] ERRO na requisição:`, err.message);
  }
}

testDecryption();
