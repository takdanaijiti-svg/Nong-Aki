import { FormEvent, useState } from 'react';
import { Coffee, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { AKI_AVATAR_URL } from '../data/initialData';
import { supabase } from '../lib/supabase';
import { sanitizeSingleLine } from '../utils/sanitize';

type AuthMode = 'login' | 'register';

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง ลองตรวจสอบอีกครั้งนะครับ';
  }
  if (lower.includes('email not confirmed')) {
    return 'กรุณากดยืนยันอีเมลในกล่องจดหมายของคุณก่อนเข้าสู่ระบบนะครับ';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'อีเมลนี้ถูกสมัครใช้งานแล้วครับ ลองสลับไปที่หน้าเข้าสู่ระบบได้เลย';
  }
  if (lower.includes('password should be at least')) {
    return 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษรครับ';
  }
  if (lower.includes('unable to validate email')) {
    return 'รูปแบบอีเมลไม่ถูกต้องครับ';
  }
  return message;
}

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);

  const handleModeSwitch = (next: AuthMode) => {
    setMode(next);
    setErrorMsg('');
    setInfoMsg('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    const cleanEmail = sanitizeSingleLine(email, 160);
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('กรุณากรอกอีเมลให้ถูกต้องครับ');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษรครับ');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setErrorMsg('รหัสผ่านทั้งสองช่องไม่ตรงกันครับ');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) {
          setErrorMsg(translateAuthError(error.message));
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });
        if (error) {
          setErrorMsg(translateAuthError(error.message));
        } else if (data.user && !data.session) {
          setInfoMsg(
            'สมัครสมาชิกสำเร็จแล้วครับน้า! กรุณาเช็กอีเมลเพื่อกดลิงก์ยืนยันตัวตน แล้วกลับมาเข้าสู่ระบบได้เลยครับ',
          );
          setMode('login');
          setPassword('');
          setConfirmPassword('');
        }
      }
    } catch {
      setErrorMsg('เชื่อมต่อระบบไม่สำเร็จชั่วคราว กรุณาลองใหม่อีกครั้งนะครับ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#FAF7F2] text-[#2F2019] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-[#EAE0D5] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          {avatarFailed ? (
            <div className="w-16 h-16 rounded-full bg-[#5C4033] text-white flex items-center justify-center mb-3">
              <Coffee className="w-8 h-8" />
            </div>
          ) : (
            <img
              src={AKI_AVATAR_URL}
              alt="น้อนอากิ้ (Nong Aki)"
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="w-16 h-16 rounded-full object-cover border border-[#EAE0D5] mb-3"
            />
          )}
          <h1 className="text-xl font-bold text-[#5C4033] tracking-tight">
            น้อนอากิ้ (Nong Aki)
          </h1>
          <p className="mt-1.5 text-sm text-[#7A6356] leading-relaxed">
            เข้าสู่ระบบเพื่อซิงค์รายรับ-รายจ่าย ตารางเวลา และโน้ตระหว่างมือถือกับคอมพิวเตอร์ครับน้า
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#FAF7F2] border border-[#EAE0D5] rounded-xl">
          <button
            type="button"
            onClick={() => handleModeSwitch('login')}
            className={`min-h-[42px] text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-[#5C4033] text-white shadow-xs'
                : 'text-[#7A6356] hover:text-[#2F2019]'
            }`}
          >
            เข้าสู่ระบบ
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('register')}
            className={`min-h-[42px] text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              mode === 'register'
                ? 'bg-[#5C4033] text-white shadow-xs'
                : 'text-[#7A6356] hover:text-[#2F2019]'
            }`}
          >
            สมัครสมาชิก
          </button>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-[#7A6356] mb-1.5">
              อีเมล
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#9A8172] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm bg-[#FAF7F2] border border-[#EAE0D5] rounded-xl text-[#2F2019] placeholder:text-[#9A8172] focus:outline-none focus:border-[#5C4033] focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-medium text-[#7A6356] mb-1.5"
            >
              รหัสผ่าน
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9A8172] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                className="w-full min-h-[44px] pl-10 pr-11 py-2.5 text-sm bg-[#FAF7F2] border border-[#EAE0D5] rounded-xl text-[#2F2019] placeholder:text-[#9A8172] focus:outline-none focus:border-[#5C4033] focus:bg-white transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-[#9A8172] hover:text-[#5C4033] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label
                htmlFor="auth-confirm-password"
                className="block text-xs font-medium text-[#7A6356] mb-1.5"
              >
                ยืนยันรหัสผ่าน
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#9A8172] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm bg-[#FAF7F2] border border-[#EAE0D5] rounded-xl text-[#2F2019] placeholder:text-[#9A8172] focus:outline-none focus:border-[#5C4033] focus:bg-white transition-colors"
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3.5 py-2.5 rounded-xl leading-relaxed">
              {errorMsg}
            </p>
          )}

          {infoMsg && (
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 rounded-xl leading-relaxed">
              {infoMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#5C4033] hover:bg-[#4A3228] disabled:opacity-60 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{mode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชีใหม่'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
