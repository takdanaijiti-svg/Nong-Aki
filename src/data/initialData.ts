import { AppSettings, ChatMessage } from '../types';
import { getLocalTimeString } from '../utils/dateFormat';

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
    text: 'ช่วยสรุปยอดรายรับรายจ่ายวันนี้ให้หน่อยน้า',
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
      'สวัสดีค่า~ น้อนอากิ้มาอยู่เป็นเพื่อนช่วยดูแลแล้วนะคะ! จะพิมพ์บอกค่าข้าว นัดหมาย โน้ตช่วยจำ หรือส่งรูปสลิปโอนเงินมาก็ได้น้า เดี๋ยวเค้าช่วยแยกหมวดแล้วเก็บเข้าบัญชีให้เรียบร้อยเลยค่ะ!',
    timestamp: getLocalTimeString(),
  };
}
