import { useEffect, useState } from 'react';
import { Bell, BellRing, Loader2, LogOut, Mail, Trash2, Volume2, X } from 'lucide-react';
import { AppSettings } from '../types';
import {
  getNotificationPermissionState,
  playGentleBell,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
} from '../utils/notifications';

interface SettingsModalProps {
  open: boolean;
  userEmail?: string;
  settings: AppSettings;
  onClose: () => void;
  onUpdateSettings: (next: AppSettings) => void;
  onClearAllData: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
  onShowToast: (title: string, body: string) => void;
}

export function SettingsModal({
  open,
  userEmail,
  settings,
  onClose,
  onUpdateSettings,
  onClearAllData,
  onSignOut,
  onShowToast,
}: SettingsModalProps) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermissionState(),
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmClear(false);
      setIsClearing(false);
      setIsSigningOut(false);
      return;
    }
    setPermission(getNotificationPermissionState());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleToggleNotifications = async () => {
    if (!settings.notificationsEnabled) {
      const result = await requestBrowserNotificationPermission();
      setPermission(result);
      onUpdateSettings({ ...settings, notificationsEnabled: true });
      if (result === 'granted') {
        sendBrowserNotification(
          'น้อนอากิ้เปิดแจ้งเตือนแล้วนะคะน้า~',
          'เมื่อถึงเวลานัดหรือเวลาสรุปยอดประจำวัน เค้าจะกระดิ่งเตือนให้นะคะ',
        );
      } else {
        onShowToast(
          'เปิดแจ้งเตือนในแอปแล้วค่ะ',
          'เบราว์เซอร์ไม่ได้อนุญาต Notification ภายนอก อากิ้จะแจ้งเตือนบนหน้าเว็บพร้อมเสียงกระดิ่งให้แทนนะคะน้า~',
        );
      }
    } else {
      onUpdateSettings({ ...settings, notificationsEnabled: false });
    }
  };

  const handleTestNotification = async () => {
    if (settings.soundEnabled) {
      playGentleBell();
    }
    let perm = permission;
    if (perm === 'default') {
      perm = await requestBrowserNotificationPermission();
      setPermission(perm);
    }
    if (perm === 'granted') {
      sendBrowserNotification(
        'กริ๊ง! ทดสอบแจ้งเตือนจากน้อนอากิ้ค่ะ',
        'ระบบเสียงกระดิ่งและการแจ้งเตือนพร้อมดูแลตารางของคุณแล้วน้า~',
      );
    }
    onShowToast(
      'กริ๊ง! ทดสอบแจ้งเตือนจากน้อนอากิ้ค่ะ',
      'ระบบเสียงกระดิ่งและการแจ้งเตือนพร้อมทำงานแล้วน้า~',
    );
  };

  const handleConfirmClearAll = async () => {
    setIsClearing(true);
    try {
      await onClearAllData();
      setConfirmClear(false);
      onClose();
    } finally {
      setIsClearing(false);
    }
  };

  const handleSignOutClick = async () => {
    setIsSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  const permissionLabel =
    permission === 'granted'
      ? 'เบราว์เซอร์อนุญาตแล้ว'
      : permission === 'denied'
        ? 'เบราว์เซอร์บล็อกไว้ (จะแจ้งเตือนบนหน้าเว็บแทน)'
        : permission === 'unsupported'
          ? 'เบราว์เซอร์ไม่รองรับ (จะแจ้งเตือนบนหน้าเว็บแทน)'
          : 'ยังไม่ขอสิทธิ์แจ้งเตือนเบราว์เซอร์';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#2F2019]/40 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-[#EAE0D5] shadow-xl overflow-hidden max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EAE0D5] shrink-0">
          <h2 id="settings-modal-title" className="text-base font-semibold text-[#2F2019]">
            ตั้งค่าและการแจ้งเตือน
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างตั้งค่า"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#7A6356] hover:text-[#5C4033] hover:bg-[#FAF7F2] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Account Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[#7A6356]">บัญชีผู้ใช้</h3>
            <div className="p-3.5 bg-[#FAF7F2] border border-[#EAE0D5] rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-white border border-[#EAE0D5] text-[#5C4033] flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-[#7A6356]">เข้าสู่ระบบด้วยอีเมล</p>
                  <p className="text-sm font-medium text-[#2F2019] truncate">
                    {userEmail || 'บัญชีผู้ใช้'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isSigningOut}
                onClick={() => void handleSignOutClick()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium text-[#5C4033] bg-white hover:bg-[#F5ECE3] border border-[#EAE0D5] rounded-lg transition-colors shrink-0 cursor-pointer disabled:opacity-60"
              >
                {isSigningOut ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogOut className="w-3.5 h-3.5" />
                )}
                <span>ออกจากระบบ</span>
              </button>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[#7A6356]">การแจ้งเตือนตารางกิจกรรม</h3>

            <div className="p-3.5 bg-[#FAF7F2] border border-[#EAE0D5] rounded-xl space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Bell className="w-4 h-4 text-[#5C4033] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#2F2019]">
                      เปิดการแจ้งเตือนผ่านเบราว์เซอร์
                    </p>
                    <p className="text-xs text-[#7A6356] mt-0.5">{permissionLabel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.notificationsEnabled}
                  onClick={() => void handleToggleNotifications()}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${
                    settings.notificationsEnabled ? 'bg-[#5C4033]' : 'bg-[#D6C7B8]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      settings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-3 border-t border-[#EAE0D5] flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Volume2 className="w-4 h-4 text-[#5C4033] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#2F2019]">เสียงกระดิ่งเบาๆ</p>
                    <p className="text-xs text-[#7A6356] mt-0.5">
                      เล่นเสียงกระดิ่งนุ่มๆ เมื่อถึงเวลานัด
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.soundEnabled}
                  onClick={() =>
                    onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${
                    settings.soundEnabled ? 'bg-[#5C4033]' : 'bg-[#D6C7B8]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      settings.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-3 border-t border-[#EAE0D5] space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <BellRing className="w-4 h-4 text-[#5C4033] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#2F2019]">
                        แจ้งเตือนสรุปรายจ่ายประจำวัน
                      </p>
                      <p className="text-xs text-[#7A6356] mt-0.5">
                        ส่งสรุปยอดใช้จ่ายของวันตามเวลาที่ตั้งไว้
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.dailySummaryEnabled}
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        dailySummaryEnabled: !settings.dailySummaryEnabled,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${
                      settings.dailySummaryEnabled ? 'bg-[#5C4033]' : 'bg-[#D6C7B8]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        settings.dailySummaryEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {settings.dailySummaryEnabled && (
                  <div className="flex items-center justify-between gap-3 pl-6">
                    <label
                      htmlFor="daily-summary-time"
                      className="text-xs font-medium text-[#7A6356]"
                    >
                      เวลาที่ให้แจ้งเตือนสรุปยอด
                    </label>
                    <input
                      id="daily-summary-time"
                      type="time"
                      value={settings.dailySummaryTime}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          dailySummaryTime: e.target.value || '20:00',
                        })
                      }
                      className="px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-[#EAE0D5] rounded-lg text-[#2F2019] focus:outline-none focus:border-[#5C4033]"
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => void handleTestNotification()}
                className="w-full py-2.5 px-4 text-xs font-medium text-[#5C4033] bg-white hover:bg-[#F5ECE3] border border-[#EAE0D5] rounded-lg transition-colors cursor-pointer"
              >
                ทดสอบเสียงกระดิ่งและการแจ้งเตือน
              </button>
            </div>
          </div>

          {/* Cloud Data Management */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[#7A6356]">จัดการข้อมูลในบัญชี</h3>
            <div className="p-3.5 bg-[#FAF7F2] border border-[#EAE0D5] rounded-xl space-y-2.5">
              <p className="text-xs text-[#7A6356] leading-relaxed">
                ข้อมูลรายรับ-รายจ่าย ตารางเวลา และโน้ตทั้งหมดถูกบันทึกและซิงค์เข้าบัญชีของคุณบนฐานข้อมูลคลาวด์อัตโนมัติค่ะ
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isClearing}
                      onClick={() => void handleConfirmClearAll()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-60 rounded-lg transition-colors min-h-[38px] cursor-pointer"
                    >
                      {isClearing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>ยืนยันล้างข้อมูลทั้งหมด</span>
                    </button>
                    <button
                      type="button"
                      disabled={isClearing}
                      onClick={() => setConfirmClear(false)}
                      className="px-3 py-2 text-xs font-medium text-[#7A6356] hover:bg-[#EAE0D5]/50 rounded-lg min-h-[38px] cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors min-h-[38px] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ล้างข้อมูลทั้งหมด</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
