import { FormEvent, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { AkiLogo } from './AkiLogo';
import { supabase } from '../lib/supabase';
import { sanitizeSingleLine } from '../utils/sanitize';

type AuthMode = 'login' | 'register';

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง ลองตรวจสอบอีกครั้งนะคะ';
  }
  if (lower.includes('email not confirmed')) {
    return 'กรุณากดยืนยันอีเมลในกล่องจดหมายของคุณก่อนเข้าสู่ระบบนะคะ';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'อีเมลนี้ถูกสมัครใช้งานแล้วค่ะ ลองสลับไปที่หน้าเข้าสู่ระบบได้เลยน้า~';
  }
  if (lower.includes('password should be at least')) {
    return 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษรนะคะ';
  }
  if (lower.includes('unable to validate email')) {
    return 'รูปแบบอีเมลไม่ถูกต้องนะคะ';
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleModeSwitch = (next: AuthMode) => {
    setMode(next);
    setErrorMsg('');
    setInfoMsg('');
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        setErrorMsg(translateAuthError(error.message));
        setGoogleLoading(false);
      }
    } catch {
      setErrorMsg('เชื่อมต่อบัญชี Google ไม่สำเร็จชั่วคราว ลองใหม่อีกครั้งนะคะ');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    const cleanEmail = sanitizeSingleLine(email, 160);
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('กรุณากรอกอีเมลให้ถูกต้องนะคะ');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษรนะคะ');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setErrorMsg('รหัสผ่านทั้งสองช่องไม่ตรงกันนะคะ');
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
            'สมัครสมาชิกสำเร็จแล้วค่ะน้า~ กรุณาเช็กอีเมลเพื่อกดลิงก์ยืนยันตัวตน แล้วกลับมาเข้าสู่ระบบได้เลยนะคะ',
          );
          setMode('login');
          setPassword('');
          setConfirmPassword('');
        }
      }
    } catch {
      setErrorMsg('เชื่อมต่อระบบไม่สำเร็จชั่วคราว กรุณาลองใหม่อีกครั้งนะคะ');
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || googleLoading;

  return (
    <div className="min-h-dvh bg-[#FAF7F2] text-[#2F2019] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-[#EAE0D5] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <AkiLogo className="w-16 h-16 mb-3" />
          <h1 className="text-xl font-bold text-[#5C4033] tracking-tight">
            น้อนอากิ้ — ผู้ช่วยส่วนตัวสุดน่ารัก
          </h1>
          <p className="mt-1.5 text-sm text-[#7A6356] leading-relaxed">
            เข้าสู่ระบบเพื่อซิงค์รายรับ-รายจ่าย ตารางเวลา และโน้ตระหว่างมือถือกับคอมพิวเตอร์นะคะ
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
            disabled={busy}
            className="w-full min-h-[46px] flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#5C4033] hover:bg-[#4A3228] disabled:opacity-60 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{mode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชีใหม่'}</span>
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#EAE0D5]" />
          <span className="text-xs text-[#9A8172] whitespace-nowrap">หรือ</span>
          <div className="h-px flex-1 bg-[#EAE0D5]" />
        </div>

        {/* Continue with Google OAuth */}
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleGoogleSignIn()}
          className="w-full min-h-[46px] flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[#5C4033] bg-white hover:bg-[#FAF7F2] border border-[#C8A27C] disabled:opacity-60 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
        >
          {googleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#5C4033]" />
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          <span>เข้าสู่ระบบด้วย Google</span>
        </button>
      </div>
    </div>
  );
}
