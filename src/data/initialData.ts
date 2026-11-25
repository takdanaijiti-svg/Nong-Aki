import { AppSettings, ChatMessage } from '../types';
import { getLocalTimeString } from '../utils/dateFormat';

export const AKI_AVATAR_URL = '/src/assets/images/aki_cafe_avatar_1795597502721.jpg';

export interface QuickPromptItem {
  label: string;
  mode: 'prefill' | 'send';
  text: string;
}

export const QUICK_PROMPTS: QuickPromptItem[] = [
  {
    label: 'จดค่าข้าว',
    mode: 'prefill',
    text: 'วันนี้กินข้าว ',
  },
  {
    label: 'เพิ่มนัดพรุ่งนี้',
    mode: 'prefill',
    text: 'พรุ่งนี้ 10 โมงมีนัด ',
  },
  {
    label: 'สรุปยอดวันนี้',
    mode: 'send',
    text: 'ช่วยสรุปยอดรายรับรายจ่ายวันนี้ให้หน่อยครับ',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  notificationsEnabled: false,
  soundEnabled: true,
  dailySummaryEnabled: true,
  dailySummaryTime: '20:00',
};

export function createWelcomeMessage(text?: string): ChatMessage {
  return {
    id: `msg_welcome_${Date.now()}`,
    role: 'assistant',
    text:
      text ??
      'สวัสดีครับน้า! น้อนอากิ้พร้อมช่วยดูแลแล้วครับ จะพิมพ์บอกค่าข้าว นัดหมาย โน้ตช่วยจำ หรืออัปโหลดรูปสลิปโอนเงินมาก็ได้น้า เดี๋ยวอากิ้ช่วยแยกหมวดแล้วบันทึกเข้าบัญชีให้อัตโนมัติเลยครับ!',
    timestamp: getLocalTimeString(),
  };
}
