import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { request } from '../services/api';
import { adminBrand, loginStrings } from '../config/adminBrand';
import { getAdminUiLang } from '../utils/adminUiLocale';
import { AdminBrandMark } from '../components/AdminBrandMark';

const Login: React.FC = () => {
  const lang = getAdminUiLang();
  const brand = adminBrand(lang);
  const copy = loginStrings(lang);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await request('/api/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });

      if (data.token) {
        login(data.token);
        navigate('/');
      } else {
        setError(copy.errorLoginFailed);
      }
    } catch (err: any) {
      setError(err.message === 'Request failed' ? copy.errorBadPassword : copy.errorNetwork);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-stretch bg-canvas dark:bg-background-dark transition-colors">
      {/* Left: form panel with stark canvas */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          {/* Yellow square wordmark - Miro signature */}
          <div className="flex items-center gap-3 mb-12">
            <AdminBrandMark size="lg" className="shadow-subtle" />
            <span className="text-text-ink dark:text-white text-lg font-semibold tracking-tight">
              {brand.productTitle}
            </span>
          </div>

          <div className="mb-10">
            <h1 className="text-text-ink dark:text-white text-[40px] sm:text-[48px] leading-[1.1] font-medium tracking-tight mb-3">
              {copy.subtitle}
            </h1>
            <p className="text-text-slate dark:text-text-secondary text-[15px]">
              {brand.tagline}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[13px] font-medium text-text-charcoal dark:text-slate-300 mb-2">
                {copy.passwordLabel}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-text-stone text-[20px]">
                  lock
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 h-12 bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-ink/10 dark:focus:ring-white/10 focus:border-ink dark:focus:border-white outline-none transition-all text-text-ink dark:text-white text-[15px] placeholder:text-text-stone"
                  placeholder={copy.passwordPlaceholder}
                  required
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-rose-light dark:bg-red-500/10 border border-rose-light dark:border-red-500/20 rounded-2xl text-coral-dark dark:text-red-400 text-[13px]">
                <span className="material-symbols-outlined text-base text-brand-red">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 btn-pill-primary text-[15px] active:scale-[0.99]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white dark:border-ink/20 dark:border-t-ink rounded-full animate-spin" />
              ) : (
                <>
                  <span>{copy.submit}</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <p className="mt-12 text-[12px] text-text-stone dark:text-slate-600">
            {brand.copyrightFooter}
          </p>
        </div>
      </div>

      {/* Right: decorative pastel canvas (Miro sticky-note vibe) — hidden on small screens */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden bg-surface dark:bg-surface-darker">
        <div className="absolute inset-0 p-12 flex items-center justify-center">
          <div className="relative w-full max-w-[480px] aspect-square">
            {/* Yellow sticky */}
            <div className="absolute top-0 left-4 w-44 h-44 rounded-3xl bg-brand-yellow rotate-[-6deg] shadow-card flex items-center justify-center p-5">
              <span className="text-ink text-sm font-medium leading-snug">
                AI 日报 ·<br />每日精选
              </span>
            </div>
            {/* Coral sticky */}
            <div className="absolute top-12 right-0 w-44 h-44 rounded-3xl bg-coral-light rotate-[5deg] shadow-card flex items-center justify-center p-5">
              <span className="text-coral-dark text-sm font-medium leading-snug">
                多智能体 ·<br />编排工作流
              </span>
            </div>
            {/* Teal sticky */}
            <div className="absolute bottom-12 left-0 w-44 h-44 rounded-3xl bg-teal-light rotate-[8deg] shadow-card flex items-center justify-center p-5">
              <span className="text-moss-dark text-sm font-medium leading-snug">
                知识库 ·<br />记忆沉淀
              </span>
            </div>
            {/* Lavender sticky */}
            <div className="absolute bottom-0 right-8 w-44 h-44 rounded-3xl bg-surface-lavender rotate-[-4deg] shadow-card flex items-center justify-center p-5">
              <span className="text-ink-deep text-sm font-medium leading-snug">
                调度中心 ·<br />运行监控
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
