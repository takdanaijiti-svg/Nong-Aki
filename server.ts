import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function sanitizeServerText(input: unknown, maxLength = 2000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\b(?:javascript|vbscript|data:text\/html)\s*:/gi, '')
    .slice(0, maxLength)
    .trim();
}

const analyzeSchema = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description:
        'คำตอบสไตล์น้อนอากิ้ ภาษาไทยที่เป็นกันเอง น่ารัก สุภาพ อบอุ่น ลงท้ายด้วย "ครับ" หรือ "น้า" สรุปสั้นๆ ว่าช่วยบันทึกอะไรให้แล้ว หรือตอบคำถามอย่างน่ารัก',
    },
    transactions: {
      type: Type.ARRAY,
      description: 'รายการรายรับหรือรายจ่ายที่วิเคราะห์ได้จากข้อความหรือสลิปโอนเงิน',
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: 'ต้องเป็น "expense" หรือ "income" เท่านั้น',
          },
          amount: {
            type: Type.NUMBER,
            description: 'จำนวนเงินเป็นตัวเลขบวก (หน่วยบาท)',
          },
          title: {
            type: Type.STRING,
            description: 'ชื่อรายการหรือร้านค้าสั้นๆ ภาษาไทยหรือชื่อร้านตามสลิป',
          },
          category: {
            type: Type.STRING,
            description:
              'สำหรับ expense ต้องเลือก 1 ค่าจาก: "อาหาร", "เดินทาง", "ของใช้", "อื่นๆ" และสำหรับ income ใช้ "รายรับ"',
          },
          date: {
            type: Type.STRING,
            description: 'วันที่รูปแบบ YYYY-MM-DD (ค.ศ.)',
          },
          time: {
            type: Type.STRING,
            description: 'เวลารูปแบบ HH:mm (24 ชั่วโมง)',
          },
        },
        required: ['type', 'amount', 'title', 'category', 'date', 'time'],
      },
    },
    schedules: {
      type: Type.ARRAY,
      description: 'รายการนัดหมาย ประชุม หรือสิ่งที่ต้องทำที่มีวัน/เวลาชัดเจน',
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'ชื่อนัดหมายหรือสิ่งที่ต้องทำ',
          },
          date: {
            type: Type.STRING,
            description: 'วันที่รูปแบบ YYYY-MM-DD (ค.ศ.)',
          },
          time: {
            type: Type.STRING,
            description: 'เวลารูปแบบ HH:mm (24 ชั่วโมง) หากไม่ระบุเวลาให้ใช้ "09:00"',
          },
          note: {
            type: Type.STRING,
            description: 'รายละเอียดเพิ่มเติมถ้ามี หรือสตริงว่าง',
          },
        },
        required: ['title', 'date', 'time'],
      },
    },
    notes: {
      type: Type.ARRAY,
      description: 'บันทึกช่วยจำ รายการของที่ต้องซื้อ หรือโน้ตทั่วไป',
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'หัวข้อโน้ตสั้นๆ',
          },
          content: {
            type: Type.STRING,
            description: 'เนื้อหาของโน้ต',
          },
          tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'แท็กสั้นๆ 1-3 คำ เช่น "ซื้อของ", "งาน", "ไอเดีย", "ส่วนตัว"',
          },
        },
        required: ['title', 'content', 'tags'],
      },
    },
  },
  required: ['reply', 'transactions', 'schedules', 'notes'],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.post('/api/chat/analyze', async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ กรุณาตรวจสอบที่เมนู Settings > Secrets ครับ',
        });
      }

      const {
        message,
        imageBase64,
        mimeType,
        currentDate,
        currentTime,
        dayOfWeek,
        dashboardContext,
      } = req.body ?? {};

      const userMessage = sanitizeServerText(message, 2000);

      if (!userMessage && !imageBase64) {
        return res.status(400).json({ error: 'กรุณาพิมพ์ข้อความหรือแนบรูปภาพสลิปก่อนส่งนะครับ' });
      }

      const safeDate =
        typeof currentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(currentDate)
          ? currentDate
          : new Date().toISOString().slice(0, 10);
      const safeTime =
        typeof currentTime === 'string' && /^\d{2}:\d{2}$/.test(currentTime)
          ? currentTime
          : '12:00';
      const safeDay = sanitizeServerText(dayOfWeek, 40) || '';

      const todayExpense = Number(dashboardContext?.todayExpense) || 0;
      const todayIncome = Number(dashboardContext?.todayIncome) || 0;
      const monthExpense = Number(dashboardContext?.monthExpense) || 0;
      const pendingSchedules = Number(dashboardContext?.pendingSchedulesCount) || 0;

      const systemInstruction = [
        `คุณคือ "น้อนอากิ้" (Nong Aki) ผู้ช่วยส่วนตัว AI น้องหมาชิบะสายคาเฟ่ที่แสนจะน่ารัก เป็นกันเอง สุภาพ อบอุ่น เหมือนเพื่อนสนิท`,
        `สไตล์การพูด: ใช้คำลงท้ายด้วย "ครับ" หรือ "น้า" อย่างน่ารัก เป็นธรรมชาติ สั้นกระชับ อ่านสบายตา เช่น "จดให้เรียบร้อยแล้วครับน้า!" หรือ "ได้เลยครับ!"`,
        `วันและเวลาปัจจุบันของระบบผู้ใช้คือ: ${safeDay ? `วัน${safeDay}ที่ ` : 'วันที่ '}${safeDate} (ค.ศ.) เวลา ${safeTime} น.`,
        `ข้อมูลสรุปปัจจุบันของผู้ใช้: รายจ่ายวันนี้ ${todayExpense} บาท, รายรับวันนี้ ${todayIncome} บาท, รายจ่ายเดือนนี้ ${monthExpense} บาท, งาน/นัดที่ค้างทำ ${pendingSchedules} รายการ`,
        `หน้าที่ของคุณคือวิเคราะห์ข้อความภาษาไทย (ซึ่งอาจมีหลายเรื่องปนกันในประโยคเดียว) และ/หรือรูปภาพสลิปโอนเงิน แล้วแยกข้อมูลออกเป็น 3 หมวดหมู่ลงใน JSON Schema อย่างแม่นยำ:`,
        `1. transactions (การเงิน):`,
        `   - ถ้ามีการจ่ายเงิน ซื้อของ กินข้าว ค่ากาแฟ ค่าเดินทาง หรือเห็นสลิปโอนเงินออก ให้บันทึกเป็น type: "expense"`,
        `   - ถ้าได้รับเงิน เงินเดือนเข้า โอนเข้า ขายของได้ ให้บันทึกเป็น type: "income" และ category: "รายรับ"`,
        `   - category ของ expense ต้องเป็นหนึ่งใน 4 ค่านี้เท่านั้น: "อาหาร", "เดินทาง", "ของใช้", "อื่นๆ"`,
        `   - หากอ่านสลิปโอนเงิน: ดึงยอดเงิน (amount) ชื่อร้านค้า/ผู้รับโอน (title) และวันเวลาในสลิป (หากเป็น พ.ศ. เช่น 2569 ให้ลบ 543 เป็น ค.ศ. 2026)`,
        `2. schedules (ตารางเวลา):`,
        `   - นัดหมาย ประชุม ส่งงาน ไปหาหมอ หรือสิ่งที่ต้องทำที่มีวันหรือเวลา (เช่น "พรุ่งนี้ 10 โมงมีส่งงาน", "อีก 2 ชั่วโมงมีประชุม")`,
        `   - คำนวณวันที่และเวลาจริงอย่างแม่นยำเทียบกับวันเวลาปัจจุบันของระบบ (${safeDate} ${safeTime}):`,
        `     * "วันนี้" -> ${safeDate}`,
        `     * "พรุ่งนี้" -> +1 วันจาก ${safeDate}`,
        `     * "มะรืน" -> +2 วันจาก ${safeDate}`,
        `     * "อีก X ชั่วโมง / อีก X นาที" -> บวกเวลาเพิ่มจาก ${safeTime} ของ ${safeDate} (ถ้าข้ามเที่ยงคืนให้เลื่อนวันด้วย)`,
        `3. notes (โน้ตช่วยจำ):`,
        `   - สิ่งที่ให้จำ ไอเดีย ลิสต์ของที่ต้องซื้อ ("อย่าลืมซื้อน้ำยาล้างจาน", "จดไว้ว่า...", "ไอเดีย...")`,
        `   - ตั้ง title ให้กระชับ และใส่ tags ภาษาไทย 1-3 คำ`,
        `กฎสำคัญ:`,
        `- ถ้าข้อความเดียวมีหลายเรื่อง ให้แยกออกทุกส่วนพร้อมกันใน JSON เดียว`,
        `- ถ้าผู้ใช้ถามสรุปยอดวันนี้ (เช่น "สรุปยอดวันนี้") ให้ตอบตัวเลขจริงจากข้อมูลสรุปปัจจุบันที่แนบไว้ให้ด้านบน และส่ง array ว่าง [] ในทุกหมวดที่ไม่ได้เพิ่มรายการใหม่`,
        `- ถ้าเป็นการทักทายหรือคุยทั่วไป ให้ส่ง array ว่าง [] และตอบกลับอย่างน่ารักอบอุ่น`,
        `- ห้ามใส่ HTML tag หรือสคริปต์ใดๆ ในคำตอบ ตอบกลับเป็น JSON ที่ถูกต้องตาม schema เท่านั้น`,
      ].join('\n');

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (imageBase64 && typeof imageBase64 === 'string') {
        const cleanBase64 = imageBase64.includes(',')
          ? imageBase64.split(',')[1]
          : imageBase64;
        const safeMime =
          typeof mimeType === 'string' && ALLOWED_IMAGE_MIMES.has(mimeType.toLowerCase())
            ? mimeType.toLowerCase()
            : 'image/jpeg';

        if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
          return res.status(400).json({ error: 'รูปแบบข้อมูลรูปภาพไม่ถูกต้องครับ' });
        }

        parts.push({
          inlineData: {
            mimeType: safeMime,
            data: cleanBase64,
          },
        });
      }

      parts.push({
        text: userMessage
          ? `ข้อความจากผู้ใช้: "${userMessage}"`
          : 'ผู้ใช้แนบรูปภาพสลิปโอนเงิน/ใบเสร็จมาให้ช่วยอ่านและบันทึกลงหมวดที่เหมาะสม',
      });

      let response;
      const attempts = [
        {
          model: 'gemini-2.5-flash',
          thinkingConfig: { thinkingBudget: 0 },
        },
        {
          model: 'gemini-3.1-flash-lite',
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      ];
      let lastErr: unknown;

      for (const cfg of attempts) {
        try {
          response = await ai.models.generateContent({
            model: cfg.model,
            contents: { parts },
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: analyzeSchema,
              thinkingConfig: cfg.thinkingConfig,
            },
          });
          lastErr = undefined;
          break;
        } catch (apiErr: unknown) {
          lastErr = apiErr;
          const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
          const shouldFallback =
            msg.includes('404') ||
            msg.includes('503') ||
            msg.includes('UNAVAILABLE') ||
            msg.includes('429');
          if (!shouldFallback) {
            throw apiErr;
          }
        }
      }

      if (!response && lastErr) {
        throw lastErr;
      }

      const rawText = (response?.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);

      const allowedExpenseCategories = new Set(['อาหาร', 'เดินทาง', 'ของใช้', 'อื่นๆ']);
      const normalized = {
        reply:
          sanitizeServerText(parsed.reply, 2000) ||
          'อากิ้จดให้เรียบร้อยแล้วครับน้า มีอะไรให้ช่วยจดเพิ่มบอกได้เลยครับ!',
        transactions: Array.isArray(parsed.transactions)
          ? parsed.transactions
              .filter((t: Record<string, unknown>) => Number(t?.amount) > 0)
              .map((t: Record<string, unknown>) => {
                const isIncome = t.type === 'income';
                const rawCat = sanitizeServerText(t.category, 40) || 'อื่นๆ';
                return {
                  type: isIncome ? 'income' : 'expense',
                  amount: Math.abs(Number(t.amount)),
                  title:
                    sanitizeServerText(t.title, 120) ||
                    (isIncome ? 'รายรับ' : 'รายจ่าย'),
                  category: isIncome
                    ? 'รายรับ'
                    : allowedExpenseCategories.has(rawCat)
                      ? rawCat
                      : 'อื่นๆ',
                  date:
                    typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date)
                      ? t.date
                      : safeDate,
                  time:
                    typeof t.time === 'string' && /^\d{2}:\d{2}$/.test(t.time)
                      ? t.time
                      : safeTime,
                };
              })
          : [],
        schedules: Array.isArray(parsed.schedules)
          ? parsed.schedules
              .filter((s: Record<string, unknown>) => Boolean(sanitizeServerText(s?.title, 160)))
              .map((s: Record<string, unknown>) => ({
                title: sanitizeServerText(s.title, 160),
                date:
                  typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date)
                    ? s.date
                    : safeDate,
                time:
                  typeof s.time === 'string' && /^\d{2}:\d{2}$/.test(s.time)
                    ? s.time
                    : '09:00',
                note: sanitizeServerText(s.note, 400),
              }))
          : [],
        notes: Array.isArray(parsed.notes)
          ? parsed.notes
              .filter((n: Record<string, unknown>) =>
                Boolean(sanitizeServerText(n?.content || n?.title, 1500)),
              )
              .map((n: Record<string, unknown>) => ({
                title: sanitizeServerText(n.title, 120) || 'บันทึกช่วยจำ',
                content: sanitizeServerText(n.content || n.title, 1500),
                tags: Array.isArray(n.tags)
                  ? n.tags
                      .map((tag) => sanitizeServerText(tag, 30).replace(/^#/, ''))
                      .filter(Boolean)
                      .slice(0, 4)
                  : ['ทั่วไป'],
              }))
          : [],
      };

      return res.json(normalized);
    } catch (err: unknown) {
      console.error('Gemini analyze error:', err);
      const message =
        err instanceof Error ? sanitizeServerText(err.message, 300) : 'เกิดข้อผิดพลาดในการวิเคราะห์ข้อมูล';
      return res.status(500).json({
        error: `ขออภัยครับ น้อนอากิ้ประมวลผลไม่สำเร็จชั่วคราว (${message})`,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
