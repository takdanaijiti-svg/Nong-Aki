import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  CalendarClock,
  Coffee,
  ImagePlus,
  Loader2,
  Pencil,
  SendHorizontal,
  StickyNote,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  AKI_AVATAR_URL,
  QUICK_PROMPTS,
  QuickPromptItem,
} from '../data/initialData';
import {
  ChatMessage,
  DashboardTab,
  NoteItem,
  ScheduleItem,
  Transaction,
} from '../types';
import { formatCurrency, formatThaiDate } from '../utils/dateFormat';
import { sanitizeImageSrc, sanitizeText } from '../utils/sanitize';

interface ChatPanelProps {
  messages: ChatMessage[];
  transactions: Transaction[];
  schedules: ScheduleItem[];
  notes: NoteItem[];
  isAnalyzing: boolean;
  onSendMessage: (payload: {
    text: string;
    imageBase64?: string;
    mimeType?: string;
    imagePreview?: string;
  }) => Promise<void>;
  onEditTransaction: (item: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onEditSchedule: (item: ScheduleItem) => void;
  onDeleteSchedule: (id: string) => void;
  onEditNote: (item: NoteItem) => void;
  onDeleteNote: (id: string) => void;
  onJumpToTab: (tab: DashboardTab) => void;
}

interface AttachedImage {
  base64: string;
  mimeType: string;
  preview: string;
  label: string;
}

export function ChatPanel({
  messages,
  transactions,
  schedules,
  notes,
  isAnalyzing,
  onSendMessage,
  onEditTransaction,
  onDeleteTransaction,
  onEditSchedule,
  onDeleteSchedule,
  onEditNote,
  onDeleteNote,
  onJumpToTab,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [attachError, setAttachError] = useState('');

  const listEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isAnalyzing]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setAttachError('กรุณาเลือกไฟล์รูปภาพ PNG, JPG หรือ WEBP เท่านั้นครับ');
      return;
    }

    setAttachError('');
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const safePreview = sanitizeImageSrc(result);
      if (!safePreview) {
        setAttachError('รูปแบบไฟล์รูปภาพไม่รองรับครับ');
        return;
      }
      setAttachedImage({
        base64: result,
        mimeType: file.type,
        preview: safePreview,
        label: sanitizeText(file.name, 80) || 'slip.jpg',
      });
    };
    reader.readAsDataURL(file);
  };

  const submitCurrent = async (overrideText?: string) => {
    if (isAnalyzing) return;
    const rawText = overrideText !== undefined ? overrideText : inputText;
    const cleanText = sanitizeText(rawText, 2000);
    if (!cleanText && (!attachedImage || overrideText !== undefined)) return;

    const payload =
      overrideText !== undefined
        ? { text: cleanText }
        : {
            text: cleanText,
            imageBase64: attachedImage?.base64,
            mimeType: attachedImage?.mimeType,
            imagePreview: attachedImage?.preview,
          };

    if (overrideText === undefined) {
      setInputText('');
      setAttachedImage(null);
    }
    setAttachError('');
    await onSendMessage(payload);
  };

  const handleQuickPrompt = (item: QuickPromptItem) => {
    if (isAnalyzing) return;
    if (item.mode === 'send') {
      void submitCurrent(item.text);
    } else {
      setInputText(item.text);
      textareaRef.current?.focus();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitCurrent();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitCurrent();
    }
  };

  return (
    <section
      aria-label="หน้าต่างแชทกับน้อนอากิ้"
      className="flex flex-col h-full min-h-0 bg-[#FAF7F2] lg:border-r border-[#EAE0D5] overflow-hidden"
    >
      {/* Chat Panel Subheader */}
      <div className="px-4 py-3 border-b border-[#EAE0D5] flex items-center justify-between gap-3 shrink-0 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          {avatarFailed ? (
            <div className="w-10 h-10 rounded-full bg-[#5C4033] text-white flex items-center justify-center shrink-0">
              <Coffee className="w-5 h-5" />
            </div>
          ) : (
            <img
              src={AKI_AVATAR_URL}
              alt="น้อนอากิ้ (Nong Aki)"
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="w-10 h-10 rounded-full object-cover border border-[#EAE0D5] shrink-0"
            />
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#2F2019] truncate">
              น้อนอากิ้ (Nong Aki)
            </h2>
            <p className="text-xs text-[#7A6356] truncate">
              พิมพ์คุย จดค่าข้าว นัดหมาย หรือส่งสลิปมาให้อากิ้ช่วยจดได้เลยครับ
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Chat History */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 bg-[#FAF7F2]">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const safePreview = sanitizeImageSrc(msg.imagePreview);
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] sm:max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-[#5C4033] text-white rounded-br-sm'
                    : msg.isError
                      ? 'bg-rose-50 border border-rose-200 text-rose-800 rounded-bl-sm'
                      : 'bg-white border border-[#EAE0D5] text-[#2F2019] rounded-bl-sm'
                }`}
              >
                {safePreview && (
                  <div className="mb-2 overflow-hidden rounded-xl border border-white/20 bg-white/10">
                    <img
                      src={safePreview}
                      alt="รูปภาพที่แนบในแชท"
                      referrerPolicy="no-referrer"
                      className="max-h-56 w-auto object-contain mx-auto"
                    />
                  </div>
                )}
                {msg.text && <p className="whitespace-pre-line">{msg.text}</p>}
              </div>

              {/* Action Summary Cards for AI Parsed Items */}
              {!isUser && msg.createdItems && msg.createdItems.length > 0 && (
                <div className="mt-2 w-full max-w-[92%] sm:max-w-[86%] space-y-2">
                  {msg.createdItems.map((ref) => {
                    if (ref.kind === 'transaction') {
                      const tx = transactions.find((t) => t.id === ref.id);
                      if (!tx) {
                        return (
                          <div
                            key={ref.id}
                            className="bg-white/70 border border-[#EAE0D5] rounded-xl px-3.5 py-2 text-xs text-[#9A8172]"
                          >
                            ลบรายการการเงินนี้ออกจากระบบแล้วครับ
                          </div>
                        );
                      }
                      const isIncome = tx.type === 'income';
                      return (
                        <div
                          key={ref.id}
                          className="bg-white border border-[#EAE0D5] rounded-xl p-3 flex items-center justify-between gap-2.5"
                        >
                          <button
                            type="button"
                            onClick={() => onJumpToTab('finance')}
                            className="flex items-center gap-2.5 min-w-0 text-left flex-1 cursor-pointer group"
                          >
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isIncome
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-[#FAF7F2] border border-[#EAE0D5] text-[#5C4033]'
                              }`}
                            >
                              <Wallet className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-[#7A6356]">
                                การเงิน · {tx.category} · {formatThaiDate(tx.date)}
                              </p>
                              <p className="text-sm font-medium text-[#2F2019] truncate group-hover:text-[#5C4033]">
                                {tx.title}{' '}
                                <span
                                  className={`font-mono tabular-nums font-semibold ${
                                    isIncome ? 'text-emerald-700' : 'text-[#5C4033]'
                                  }`}
                                >
                                  {isIncome ? '+' : '-'}฿{formatCurrency(tx.amount)}
                                </span>
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => onEditTransaction(tx)}
                              aria-label={`แก้ไข ${tx.title}`}
                              className="min-w-[34px] min-h-[34px] flex items-center justify-center text-[#9A8172] hover:text-[#5C4033] hover:bg-[#FAF7F2] rounded-lg transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteTransaction(tx.id)}
                              aria-label={`ลบ ${tx.title}`}
                              className="min-w-[34px] min-h-[34px] flex items-center justify-center text-[#9A8172] hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (ref.kind === 'schedule') {
                      const sch = schedules.find((s) => s.id === ref.id);
                      if (!sch) {
                        return (
                          <div
                            key={ref.id}
                            className="bg-white/70 border border-[#EAE0D5] rounded-xl px-3.5 py-2 text-xs text-[#9A8172]"
                          >
                            ลบรายการตารางเวลานี้แล้วครับ
                          </div>
                        );
                      }
                      return (
                        <div
                          key={ref.id}
                          className="bg-white border border-[#EAE0D5] rounded-xl p-3 flex items-center justify-between gap-2.5"
                        >
                          <button
                            type="button"
                            onClick={() => onJumpToTab('schedule')}
                            className="flex items-center gap-2.5 min-w-0 text-left flex-1 cursor-pointer group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-[#F5ECE3] text-[#5C4033] flex items-center justify-center shrink-0">
                              <CalendarClock className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-[#7A6356]">
                                ตารางเวลา · {formatThaiDate(sch.date)} ·{' '}
                                <span className="font-mono tabular-nums">{sch.time} น.</span>
                              </p>
                              <p className="text-sm font-medium text-[#2F2019] truncate group-hover:text-[#5C4033]">
                                {sch.title}
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => onEditSchedule(sch)}
                              aria-label={`แก้ไข ${sch.title}`}
                              className="min-w-[34px] min-h-[34px] flex items-center justify-center text-[#9A8172] hover:text-[#5C4033] hover:bg-[#FAF7F2] rounded-lg transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteSchedule(sch.id)}
                              aria-label={`ลบ ${sch.title}`}
                              className="min-w-[34px] min-h-[34px] flex items-center justify-center text-[#9A8172] hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    const note = notes.find((n) => n.id === ref.id);
                    if (!note) {
                      return (
                        <div
                          key={ref.id}
                          className="bg-white/70 border border-[#EAE0D5] rounded-xl px-3.5 py-2 text-xs text-[#9A8172]"
                        >
                          ลบโน้ตนี้แล้วครับ
                        </div>
                      );
                    }
                    return (
                      <div
                        key={ref.id}
                        className="bg-white border border-[#EAE0D5] rounded-xl p-3 flex items-center justify-between gap-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => onJumpToTab('notes')}
                          className="flex items-center gap-2.5 min-w-0 text-left flex-1 cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-[#F5ECE3] text-[#5C4033] flex items-center justify-center shrink-0">
                            <StickyNote className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-[#7A6356] truncate">
                              โน้ต · {note.tags.map((t) => `#${t}`).join(' · ')}
                            </p>
                            <p className="text-sm font-medium text-[#2F2019] truncate group-hover:text-[#5C4033]">
                              {note.title} — {note.content}
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onEditNote(note)}
                            aria-label={`แก้ไข ${note.title}`}
                            className="min-w-[34px] min-h-[34px] flex items-center justify-center text-[#9A8172] hover:text-[#5C4033] hover:bg-[#FAF7F2] rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteNote(note.id)}
                            aria-label={`ลบ ${note.title}`}
                            className="min-w-[34px] min-h-[34px] flex items-center justify-center text-[#9A8172] hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <span className="mt-1 px-1 text-[11px] font-mono tabular-nums text-[#9A8172]">
                {msg.timestamp}
              </span>
            </div>
          );
        })}

        {isAnalyzing && (
          <div className="flex items-start">
            <div className="bg-white border border-[#EAE0D5] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2.5 text-sm text-[#7A6356]">
              <Loader2 className="w-4 h-4 animate-spin text-[#5C4033]" />
              <span>น้อนอากิ้กำลังอ่านและแยกข้อมูลให้น้า...</span>
            </div>
          </div>
        )}

        <div ref={listEndRef} />
      </div>

      {/* Quick Prompts Bar (Mobile-First One-Handed Shortcuts) */}
      <div className="relative z-20 px-3 py-2 bg-white border-t border-[#EAE0D5] flex items-center gap-2 overflow-x-auto shrink-0">
        {QUICK_PROMPTS.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={isAnalyzing}
            onClick={() => handleQuickPrompt(item)}
            className="px-3 py-1.5 min-h-[36px] text-xs font-medium text-[#5C4033] bg-[#FAF7F2] hover:bg-[#F5ECE3] border border-[#EAE0D5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Bottom Composer */}
      <div className="relative z-30 p-3 bg-white border-t border-[#EAE0D5] shrink-0">
        {attachedImage && (
          <div className="mb-2.5 flex items-center justify-between gap-2 p-2 bg-[#FAF7F2] border border-[#EAE0D5] rounded-xl">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={attachedImage.preview}
                alt={attachedImage.label}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-lg object-cover border border-[#EAE0D5] shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#2F2019] truncate">{attachedImage.label}</p>
                <p className="text-[11px] text-[#7A6356]">พร้อมส่งให้น้อนอากิ้อ่านสลิปครับ</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              aria-label="ลบรูปที่แนบ"
              className="min-w-[34px] min-h-[34px] flex items-center justify-center text-[#9A8172] hover:text-rose-700 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {attachError && (
          <p className="mb-2 text-xs text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg">
            {attachError}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="อัปโหลดรูปภาพหรือสลิปโอนเงิน"
            title="อัปโหลดรูปภาพ/สลิป"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#5C4033] bg-[#FAF7F2] hover:bg-[#F5ECE3] border border-[#EAE0D5] rounded-xl transition-colors shrink-0 cursor-pointer"
          >
            <ImagePlus className="w-5 h-5" />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setTimeout(() => {
                listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 150);
            }}
            placeholder="พิมพ์คุยกับน้อนอากิ้ได้เลยครับ..."
            className="flex-1 min-h-[44px] max-h-28 px-3.5 py-2.5 text-[16px] sm:text-sm bg-[#FAF7F2] border border-[#EAE0D5] rounded-xl text-[#2F2019] placeholder:text-[#9A8172] focus:outline-none focus:border-[#5C4033] focus:bg-white resize-none leading-snug touch-manipulation"
          />

          <button
            type="submit"
            disabled={isAnalyzing || (!inputText.trim() && !attachedImage)}
            aria-label="ส่งข้อความ"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-[#5C4033] hover:bg-[#4A3228] disabled:bg-[#EAE0D5] disabled:text-[#9A8172] text-white rounded-xl transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            <SendHorizontal className="w-5 h-5" />
          </button>
        </form>
      </div>
    </section>
  );
}
