import { useCallback, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileCenter } from "@/components/profile-center";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  clearStoredAuthSession,
  loadStoredAuthSession,
  login,
  normalizeEmail,
  register,
  storeAuthSession,
  type AuthSession,
  type StoredAuthSession,
} from "@/lib/auth";

type AuthMode = "login" | "register";
type StatusKind = "idle" | "success" | "error";

type FieldProps = {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  autoComplete?: string;
  required?: boolean;
  value: string;
  onValueChange: (value: string) => void;
};

type LoginFormState = {
  account: string;
  password: string;
  rememberMe: boolean;
};

type RegisterFormState = {
  username: string;
  nickname: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
};

function Field({
  id,
  label,
  type,
  placeholder,
  autoComplete,
  required = true,
  value,
  onValueChange,
}: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </div>
  );
}

function authSummary(session: AuthSession) {
  return `${session.user.username} · ${session.user.email}`;
}

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function App() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginForm, setLoginForm] = useState<LoginFormState>({
    account: "",
    password: "",
    rememberMe: true,
  });
  const [registerForm, setRegisterForm] = useState<RegisterFormState>({
    username: "",
    nickname: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });
  const [statusKind, setStatusKind] = useState<StatusKind>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [session, setSession] = useState<StoredAuthSession | null>(() =>
    loadStoredAuthSession()
  );

  const statusTone = useMemo(() => {
    if (statusKind === "success") {
      return "border-[#D7F0DD] bg-[#F3FBF5] text-[#0A7A2F]";
    }
    if (statusKind === "error") {
      return "border-[#F2D6D6] bg-[#FFF6F6] text-[#B42318]";
    }
    return "border-[#E5E5E7] bg-white text-[#1D1D1F]";
  }, [statusKind]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusKind("idle");
    setStatusMessage("");

    try {
      if (mode === "login") {
        if (!loginForm.account.trim()) {
          throw new Error("请输入邮箱或用户名");
        }
        if (!loginForm.password) {
          throw new Error("请输入密码");
        }

        const response = await login({
          account: loginForm.account.trim(),
          password: loginForm.password,
        });
        const stored = storeAuthSession(response, loginForm.rememberMe);
        setSession(stored);
        setStatusKind("success");
        setStatusMessage(`登录成功：${authSummary(response)}`);
        return;
      }

      const username = registerForm.username.trim();
      const nickname = registerForm.nickname.trim();
      const email = normalizeEmail(registerForm.email);
      const passwordBytes = getUtf8ByteLength(registerForm.password);

      if (username.length < 3 || username.length > 64) {
        throw new Error("用户名长度必须在 3 到 64 个字符之间");
      }
      if (/\s/.test(username)) {
        throw new Error("用户名不能包含空白字符");
      }
      if (nickname && (nickname.length < 1 || nickname.length > 64)) {
        throw new Error("昵称长度必须在 1 到 64 个字符之间");
      }
      if (passwordBytes < 8 || passwordBytes > 72) {
        throw new Error("密码长度必须在 8 到 72 bytes 之间");
      }
      if (registerForm.password !== registerForm.confirmPassword) {
        throw new Error("两次输入的密码不一致");
      }

      if (!registerForm.agreeTerms) {
        throw new Error("请先勾选用户协议");
      }

      const response = await register({
        username,
        nickname: nickname || undefined,
        email,
        password: registerForm.password,
      });
      const stored = storeAuthSession(response, true);
      setSession(stored);
      setStatusKind("success");
      setStatusMessage(`注册成功：${authSummary(response)}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "请求失败，请稍后重试";
      setStatusKind("error");
      setStatusMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    clearStoredAuthSession();
    setSession(null);
    setStatusKind("success");
    setStatusMessage("已清除本地会话");
  };

  const handleSessionChange = useCallback((nextSession: StoredAuthSession) => {
    setSession(nextSession);
  }, []);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#FFFFFF_0%,#F5F5F7_100%)] text-[#1D1D1F]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-center border-b border-[#E5E5E7] py-3">
          <a
            href="/"
            className="text-[16px] font-medium text-[#1D1D1F] transition-opacity duration-300 ease-out hover:opacity-70"
            aria-label="博客首页"
            onClick={(event) => event.preventDefault()}
          >
            博客
          </a>
        </header>

        {session ? (
          <ProfileCenter
            session={session}
            onSessionChange={handleSessionChange}
            onLogout={handleLogout}
          />
        ) : (
        <main className="flex flex-1 items-center justify-center py-8 sm:py-12">
          <section className="w-full max-w-2xl">
            <div className="mb-7 text-center sm:mb-9">
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#1D1D1F] sm:text-5xl">
                进入你的博客系统
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#86868B] sm:text-base">
                登录已有账号，或切换到注册标签快速创建新账户。
              </p>
            </div>

            <div className="rounded-[32px] border border-[#E5E5E7] bg-white/78 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl sm:p-6 md:p-8">
              {/* Keep login and registration in one shell so the page never navigates away. */}
              <Tabs
                value={mode}
                onValueChange={(value) => {
                  setMode(value as AuthMode);
                  setStatusKind("idle");
                  setStatusMessage("");
                }}
                className="w-full"
              >
                <TabsList className="grid h-14 w-full grid-cols-2 rounded-full border border-[#E5E5E7] bg-[#F5F5F7] p-1">
                  <TabsTrigger value="login">登录</TabsTrigger>
                  <TabsTrigger value="register">注册</TabsTrigger>
                </TabsList>

                <div className="mt-6 sm:mt-8">
                  <TabsContent value="login" className="mt-0 outline-none">
                    <form className="space-y-5" onSubmit={handleSubmit}>
                      <Field
                        id="login-account"
                        label="邮箱或用户名"
                        type="text"
                        placeholder="admin 或 admin@example.com"
                        autoComplete="username"
                        value={loginForm.account}
                        onValueChange={(value) =>
                          setLoginForm((current) => ({
                            ...current,
                            account: value.trimStart(),
                          }))
                        }
                      />

                      <Field
                        id="login-password"
                        label="密码"
                        type="password"
                        placeholder="请输入密码"
                        autoComplete="current-password"
                        value={loginForm.password}
                        onValueChange={(value) =>
                          setLoginForm((current) => ({
                            ...current,
                            password: value,
                          }))
                        }
                      />

                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <label
                          htmlFor="remember-me"
                          className="flex items-center gap-3 text-sm text-[#1D1D1F]"
                        >
                          <Checkbox
                            id="remember-me"
                            name="remember-me"
                            checked={loginForm.rememberMe}
                            onCheckedChange={(checked) => {
                              setLoginForm((current) => ({
                                ...current,
                                rememberMe: checked === true,
                              }));
                            }}
                          />
                          <span>记住我</span>
                        </label>

                        <a
                          href="#forgot-password"
                          className="text-sm text-[#86868B] transition-opacity duration-300 ease-out hover:opacity-70"
                          onClick={(event) => event.preventDefault()}
                        >
                          忘记密码
                        </a>
                      </div>

                      <Button
                        type="submit"
                        className="h-12 w-full text-[15px]"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            正在登录
                          </>
                        ) : (
                          "登录"
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="register" className="mt-0 outline-none">
                    <form className="space-y-5" onSubmit={handleSubmit}>
                      <Field
                        id="username"
                        label="用户名"
                        type="text"
                        placeholder="3-64 位，不能含空白字符"
                        autoComplete="username"
                        value={registerForm.username}
                        onValueChange={(value) =>
                          setRegisterForm((current) => ({
                            ...current,
                            username: value.trimStart(),
                          }))
                        }
                      />

                      <Field
                        id="nickname"
                        label="昵称"
                        type="text"
                        placeholder="请输入昵称"
                        autoComplete="nickname"
                        required={false}
                        value={registerForm.nickname}
                        onValueChange={(value) =>
                          setRegisterForm((current) => ({
                            ...current,
                            nickname: value,
                          }))
                        }
                      />

                      <Field
                        id="register-email"
                        label="邮箱"
                        type="email"
                        placeholder="name@example.com"
                        autoComplete="email"
                        value={registerForm.email}
                        onValueChange={(value) =>
                          setRegisterForm((current) => ({
                            ...current,
                            email: value,
                          }))
                        }
                      />

                      <Field
                        id="register-password"
                        label="密码"
                        type="password"
                        placeholder="8-72 bytes"
                        autoComplete="new-password"
                        value={registerForm.password}
                        onValueChange={(value) =>
                          setRegisterForm((current) => ({
                            ...current,
                            password: value,
                          }))
                        }
                      />

                      <Field
                        id="confirm-password"
                        label="确认密码"
                        type="password"
                        placeholder="再次输入密码"
                        autoComplete="new-password"
                        value={registerForm.confirmPassword}
                        onValueChange={(value) =>
                          setRegisterForm((current) => ({
                            ...current,
                            confirmPassword: value,
                          }))
                        }
                      />

                      <label
                        htmlFor="terms"
                        className="flex items-start gap-3 text-sm leading-6 text-[#1D1D1F]"
                      >
                        <Checkbox
                          id="terms"
                          name="terms"
                          checked={registerForm.agreeTerms}
                          onCheckedChange={(checked) => {
                            setRegisterForm((current) => ({
                              ...current,
                              agreeTerms: checked === true,
                            }));
                          }}
                        />
                        <span className="text-[#86868B]">
                          我已阅读并同意用户协议
                        </span>
                      </label>

                      <Button
                        type="submit"
                        className="h-12 w-full text-[15px]"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            正在注册
                          </>
                        ) : (
                          "注册"
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </div>
              </Tabs>

              {statusMessage ? (
                <div
                  className={`mt-5 flex items-start gap-3 rounded-[24px] border px-4 py-3 text-sm ${statusTone}`}
                >
                  {statusKind === "success" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p>{statusMessage}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </main>
        )}

        <footer className="flex flex-col gap-3 border-t border-[#E5E5E7] py-4 text-xs text-[#86868B] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 博客系统</p>
          <div className="flex items-center gap-5">
            <a
              href="#privacy-policy"
              className="transition-opacity duration-300 ease-out hover:opacity-70"
              onClick={(event) => event.preventDefault()}
            >
              隐私政策
            </a>
            <a
              href="#terms-of-service"
              className="transition-opacity duration-300 ease-out hover:opacity-70"
              onClick={(event) => event.preventDefault()}
            >
              用户服务条款
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
