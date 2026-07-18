import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  BarChart3,
  BookOpenText,
  CheckCircle2,
  Heart,
  ImageUp,
  LockKeyhole,
  Loader2,
  MessageCircle,
  PenLine,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCurrentUser,
  normalizeEmail,
  updateCurrentUser,
  updateStoredAuthUser,
  uploadAvatar,
  type AuthUser,
  type StoredAuthSession,
} from "@/lib/auth";

type ProfileCenterProps = {
  session: StoredAuthSession;
  onSessionChange: (session: StoredAuthSession) => void;
  onLogout: () => void;
};

type StatCardProps = {
  label: string;
  value: string;
  hint: string;
};

type ItemRowProps = {
  title: string;
  meta: string;
  action: string;
};

type Notice = {
  kind: "success" | "error";
  message: string;
};

type ProfileFormState = {
  username: string;
  nickname: string;
  email: string;
  bio: string;
};

const tabs = [
  { value: "profile", label: "个人资料", icon: UserRound },
  { value: "favorites", label: "我的收藏", icon: Heart },
  { value: "articles", label: "文章管理", icon: BookOpenText },
  { value: "comments", label: "评论管理", icon: MessageCircle },
  { value: "dashboard", label: "数据看板", icon: BarChart3 },
  { value: "security", label: "账号安全", icon: ShieldCheck },
] as const;

const favoriteItems = [
  ["苹果式排版里的留白节奏", "收藏于 2 天前 · 设计札记", "查看"],
  ["React 表单状态拆分实践", "收藏于 5 天前 · 前端工程", "查看"],
  ["博客系统鉴权链路复盘", "收藏于 7 天前 · 系统设计", "查看"],
] as const;

const articleItems = [
  ["浅色后台的视觉密度控制", "草稿 · 最后编辑 10:24", "继续编辑"],
  ["从登录页到个人中心的体验衔接", "已发布 · 1,284 阅读", "管理"],
  ["Tailwind v4 在 Vite 项目中的落地", "已发布 · 856 阅读", "管理"],
] as const;

const commentItems = [
  ["这篇登录接口讲解很清楚。", "待回复 · 来自 Admin", "回复"],
  ["希望补充 refresh token 的流程。", "已标记 · 来自 Lee", "处理"],
  ["收藏管理模块的筛选很好用。", "已通过 · 来自 Mira", "查看"],
] as const;

const dashboardStats = [
  { label: "文章阅读", value: "24.8k", hint: "较上周 +12%" },
  { label: "新增收藏", value: "328", hint: "本月累计" },
  { label: "评论互动", value: "96", hint: "待处理 2 条" },
  { label: "草稿数量", value: "7", hint: "3 篇近期编辑" },
] as const;

function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-[28px] border border-[#E5E5E7] bg-white/80 p-5 backdrop-blur-xl">
      <p className="text-sm text-[#86868B]">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[#1D1D1F]">{value}</p>
      <p className="mt-2 text-xs text-[#86868B]">{hint}</p>
    </div>
  );
}

function ItemRow({ title, meta, action }: ItemRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#E5E5E7] py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium text-[#1D1D1F]">
          {title}
        </p>
        <p className="mt-1 text-sm text-[#86868B]">{meta}</p>
      </div>
      <Button variant="secondary" size="sm" type="button">
        {action}
      </Button>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-sm text-[#86868B]">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-normal text-[#1D1D1F]">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#86868B]">
        {description}
      </p>
    </div>
  );
}

function toProfileForm(user: AuthUser): ProfileFormState {
  return {
    username: user.username,
    nickname: user.nickname,
    email: user.email,
    bio: user.bio,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败，请稍后重试";
}

function NoticeBanner({ notice }: { notice: Notice }) {
  const isSuccess = notice.kind === "success";

  return (
    <div
      className={`mt-5 flex items-start gap-3 rounded-[24px] border px-4 py-3 text-sm ${
        isSuccess
          ? "border-[#D7F0DD] bg-[#F3FBF5] text-[#0A7A2F]"
          : "border-[#F2D6D6] bg-[#FFF6F6] text-[#B42318]"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <p>{notice.message}</p>
    </div>
  );
}

function mergeUserIntoSession(session: StoredAuthSession, user: AuthUser) {
  return updateStoredAuthUser(user) ?? { ...session, user };
}

function ProfilePane({
  session,
  onSessionChange,
}: {
  session: StoredAuthSession;
  onSessionChange: (session: StoredAuthSession) => void;
}) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProfileFormState>(() =>
    toProfileForm(session.user)
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const avatarInitial = useMemo(
    () => (session.user.nickname || session.user.username).slice(0, 1).toUpperCase(),
    [session.user.nickname, session.user.username]
  );

  useEffect(() => {
    let ignore = false;

    async function syncCurrentUser() {
      setIsRefreshing(true);
      try {
        const user = await getCurrentUser();
        if (ignore) {
          return;
        }
        const nextSession = updateStoredAuthUser(user);
        setForm(toProfileForm(user));
        if (nextSession) {
          onSessionChange(nextSession);
        }
      } catch (error) {
        if (!ignore) {
          setNotice({ kind: "error", message: getErrorMessage(error) });
        }
      } finally {
        if (!ignore) {
          setIsRefreshing(false);
        }
      }
    }

    void syncCurrentUser();

    return () => {
      ignore = true;
    };
  }, [onSessionChange, session.access_token]);

  const updateForm = (field: keyof ProfileFormState, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const refreshProfile = async () => {
    setIsRefreshing(true);
    setNotice(null);

    try {
      const user = await getCurrentUser();
      const nextSession = mergeUserIntoSession(session, user);
      setForm(toProfileForm(user));
      onSessionChange(nextSession);
      setNotice({ kind: "success", message: "个人资料已刷新" });
    } catch (error) {
      setNotice({ kind: "error", message: getErrorMessage(error) });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);

    try {
      const username = form.username.trim();
      const nickname = form.nickname.trim();
      const email = normalizeEmail(form.email);
      const bio = form.bio;

      if (username.length < 3 || username.length > 64) {
        throw new Error("用户名长度必须在 3 到 64 个字符之间");
      }
      if (/\s/.test(username)) {
        throw new Error("用户名不能包含空白字符");
      }
      if (nickname.length < 1 || nickname.length > 64) {
        throw new Error("昵称长度必须在 1 到 64 个字符之间");
      }
      if (!email) {
        throw new Error("请输入邮箱");
      }
      if (bio.length > 500) {
        throw new Error("个人简介最多 500 个字符");
      }

      const user = await updateCurrentUser({
        username,
        nickname,
        email,
        bio,
      });
      const nextSession = mergeUserIntoSession(session, user);
      setForm(toProfileForm(user));
      onSessionChange(nextSession);
      setNotice({ kind: "success", message: "个人资料已保存" });
    } catch (error) {
      setNotice({ kind: "error", message: getErrorMessage(error) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsUploadingAvatar(true);
    setNotice(null);

    try {
      const supportedTypes = new Set([
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ]);

      if (!supportedTypes.has(file.type)) {
        throw new Error("头像仅支持 JPG、PNG、GIF 或 WebP");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("头像文件不能超过 5MB");
      }

      const result = await uploadAvatar(file);
      const nextSession = mergeUserIntoSession(session, result.user);
      setForm(toProfileForm(result.user));
      onSessionChange(nextSession);
      setNotice({ kind: "success", message: "头像已上传" });
    } catch (error) {
      setNotice({ kind: "error", message: getErrorMessage(error) });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <form
        className="rounded-[32px] border border-[#E5E5E7] bg-white/82 p-6 backdrop-blur-2xl"
        onSubmit={handleProfileSubmit}
      >
        <SectionHeader
          eyebrow="Profile"
          title="个人资料修改"
          description="维护公开展示信息，保持昵称、邮箱和个人简介清晰一致。"
        />

        {notice ? <NoticeBanner notice={notice} /> : null}

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-username">用户名</Label>
            <Input
              id="profile-username"
              value={form.username}
              onChange={(event) => updateForm("username", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-nickname">昵称</Label>
            <Input
              id="profile-nickname"
              value={form.nickname}
              onChange={(event) => updateForm("nickname", event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="profile-email">邮箱</Label>
            <Input
              id="profile-email"
              type="email"
              value={form.email}
              onChange={(event) => updateForm("email", event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="profile-bio">个人简介</Label>
            <textarea
              id="profile-bio"
              className="min-h-28 w-full resize-none rounded-2xl border border-[#E5E5E7] bg-white px-4 py-3 text-[15px] text-[#1D1D1F] outline-none transition-[border-color,box-shadow] duration-300 ease-out placeholder:text-[#86868B] hover:border-[#BFD9FF] focus:border-[#007AFF] focus:shadow-[0_0_0_4px_rgba(0,122,255,0.08)]"
              value={form.bio}
              onChange={(event) => updateForm("bio", event.target.value)}
              placeholder="写一点关于你的博客方向"
            />
            <p className="text-xs text-[#86868B]">{form.bio.length}/500</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="secondary"
            type="button"
            onClick={refreshProfile}
            disabled={isRefreshing || isSaving || isUploadingAvatar}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            刷新资料
          </Button>
          <Button type="submit" disabled={isSaving || isUploadingAvatar}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PenLine className="h-4 w-4" />
            )}
            保存资料
          </Button>
        </div>
      </form>

      <div className="rounded-[32px] border border-[#E5E5E7] bg-[#F5F5F7]/82 p-6 backdrop-blur-2xl">
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleAvatarChange}
        />
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#007AFF] text-2xl font-semibold text-white">
          {session.user.avatar_url ? (
            <img
              src={session.user.avatar_url}
              alt="用户头像"
              className="h-full w-full object-cover"
            />
          ) : (
            avatarInitial
          )}
        </div>
        <p className="mt-5 text-xl font-semibold text-[#1D1D1F]">
          {session.user.nickname || session.user.username}
        </p>
        <p className="mt-2 break-all text-sm text-[#86868B]">{session.user.email}</p>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          className="mt-5"
          onClick={() => avatarInputRef.current?.click()}
          disabled={isUploadingAvatar}
        >
          {isUploadingAvatar ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageUp className="h-4 w-4" />
          )}
          上传头像
        </Button>
        <p className="mt-3 text-xs leading-5 text-[#86868B]">
          支持 JPG、PNG、GIF、WebP，最大 5MB。
        </p>
        <div className="mt-6 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[#86868B]">角色</span>
            <span className="text-[#1D1D1F]">Role {session.user.role}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#86868B]">状态</span>
            <span className="text-[#0A7A2F]">正常</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#86868B]">会话</span>
            <span className="text-[#1D1D1F]">{session.storage}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FavoritesPane() {
  return (
    <div className="rounded-[32px] border border-[#E5E5E7] bg-white/82 p-6 backdrop-blur-2xl">
      <SectionHeader
        eyebrow="Favorites"
        title="我的收藏"
        description="集中管理收藏文章，快速回到值得复读的内容。"
      />
      <div className="mt-6">
        {favoriteItems.map(([title, meta, action]) => (
          <ItemRow key={title} title={title} meta={meta} action={action} />
        ))}
      </div>
    </div>
  );
}

function ArticlesPane() {
  return (
    <div className="rounded-[32px] border border-[#E5E5E7] bg-white/82 p-6 backdrop-blur-2xl">
      <SectionHeader
        eyebrow="Articles"
        title="文章草稿 / 发布管理"
        description="跟踪草稿、已发布文章和近期编辑状态，保持创作流程轻量。"
      />
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <StatCard label="已发布" value="18" hint="公开文章" />
        <StatCard label="草稿" value="7" hint="待完善内容" />
        <StatCard label="本周更新" value="4" hint="保持稳定输出" />
      </div>
      <div className="mt-6">
        {articleItems.map(([title, meta, action]) => (
          <ItemRow key={title} title={title} meta={meta} action={action} />
        ))}
      </div>
    </div>
  );
}

function CommentsPane() {
  return (
    <div className="rounded-[32px] border border-[#E5E5E7] bg-white/82 p-6 backdrop-blur-2xl">
      <SectionHeader
        eyebrow="Comments"
        title="评论管理"
        description="查看待回复、已标记和已通过评论，维持讨论质量。"
      />
      <div className="mt-6">
        {commentItems.map(([title, meta, action]) => (
          <ItemRow key={title} title={title} meta={meta} action={action} />
        ))}
      </div>
    </div>
  );
}

function DashboardPane() {
  return (
    <div className="rounded-[32px] border border-[#E5E5E7] bg-white/82 p-6 backdrop-blur-2xl">
      <SectionHeader
        eyebrow="Dashboard"
        title="数据看板"
        description="用克制的数据卡片展示阅读、收藏、评论和草稿状态。"
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
      <div className="mt-6 rounded-[28px] border border-[#E5E5E7] bg-[#F5F5F7]/80 p-5">
        <div className="flex items-center gap-3 text-[#1D1D1F]">
          <BarChart3 className="h-5 w-5 text-[#007AFF]" />
          <p className="font-medium">最近 7 天趋势</p>
        </div>
        <div className="mt-5 flex h-36 items-end gap-3">
          {[42, 68, 54, 86, 72, 92, 78].map((height, index) => (
            <div
              key={height + index}
              className="flex flex-1 items-end rounded-full bg-white"
            >
              <div
                className="w-full rounded-full bg-[#007AFF] transition-[height,opacity] duration-500 ease-out hover:opacity-85"
                style={{ height: `${height}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SecurityPane({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="rounded-[32px] border border-[#E5E5E7] bg-white/82 p-6 backdrop-blur-2xl">
      <SectionHeader
        eyebrow="Security"
        title="账号安全"
        description="检查登录会话、密码状态和本地 token 存储，减少账号风险。"
      />
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] border border-[#E5E5E7] bg-[#F5F5F7]/80 p-5">
          <LockKeyhole className="h-5 w-5 text-[#007AFF]" />
          <p className="mt-4 font-medium text-[#1D1D1F]">密码</p>
          <p className="mt-2 text-sm leading-6 text-[#86868B]">建议定期更新强密码。</p>
        </div>
        <div className="rounded-[28px] border border-[#E5E5E7] bg-[#F5F5F7]/80 p-5">
          <ShieldCheck className="h-5 w-5 text-[#007AFF]" />
          <p className="mt-4 font-medium text-[#1D1D1F]">会话</p>
          <p className="mt-2 text-sm leading-6 text-[#86868B]">当前 token 已保存在本地。</p>
        </div>
        <div className="rounded-[28px] border border-[#E5E5E7] bg-[#F5F5F7]/80 p-5">
          <CheckCircle2 className="h-5 w-5 text-[#0A7A2F]" />
          <p className="mt-4 font-medium text-[#1D1D1F]">状态</p>
          <p className="mt-2 text-sm leading-6 text-[#86868B]">账号处于正常可用状态。</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="secondary" type="button" onClick={onLogout}>
          退出并清除会话
        </Button>
      </div>
    </div>
  );
}

export function ProfileCenter({
  session,
  onSessionChange,
  onLogout,
}: ProfileCenterProps) {
  return (
    <main className="flex-1 py-8 sm:py-12">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-[#86868B]">Personal Center</p>
            <h1 className="mt-3 text-5xl font-semibold leading-tight text-[#1D1D1F]">
              个人中心
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#86868B]">
              以轻量方式管理博客身份、内容资产、互动评论和账号安全。
            </p>
          </div>
          <Button variant="secondary" type="button" onClick={onLogout}>
            退出登录
          </Button>
        </div>

        <Tabs defaultValue="profile" className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
          <TabsList className="grid h-auto gap-2 rounded-[30px] border border-[#E5E5E7] bg-white/74 p-2 backdrop-blur-2xl">
            {tabs.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-12 justify-start gap-3 px-4"
              >
                <Icon className="h-4 w-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-w-0">
            <TabsContent value="profile">
              <ProfilePane
                session={session}
                onSessionChange={onSessionChange}
              />
            </TabsContent>
            <TabsContent value="favorites">
              <FavoritesPane />
            </TabsContent>
            <TabsContent value="articles">
              <ArticlesPane />
            </TabsContent>
            <TabsContent value="comments">
              <CommentsPane />
            </TabsContent>
            <TabsContent value="dashboard">
              <DashboardPane />
            </TabsContent>
            <TabsContent value="security">
              <SecurityPane onLogout={onLogout} />
            </TabsContent>
          </div>
        </Tabs>
      </section>
    </main>
  );
}
