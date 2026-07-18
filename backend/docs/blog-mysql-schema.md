# 博客 MySQL 表结构设计

## 1. 设计目标

这份方案面向单站点博客系统，优先满足：

1. 结构清晰，后续好扩展。
2. 字段克制，避免过度拆表。
3. 能直接用 Gorm `AutoMigrate()` 创建。
4. 适合登录注册、文章、分类、标签、评论、媒体资源这些核心能力。

## 2. 设计原则

1. 统一使用 `bigint unsigned` 作为主键。
2. 统一使用 `snake_case` 命名。
3. 所有核心表保留 `created_at`、`updated_at`、`deleted_at`。
4. 状态字段统一用 `tinyint unsigned`，不使用 MySQL `enum`。
5. 文章、评论、媒体等高频表保留必要的冗余计数字段，减少聚合查询。
6. 不先引入 RBAC、全文索引、审计日志这类重型设计，后续需要再加。

## 3. 认证方案

登录注册采用最常见也最稳妥的一套：

1. 注册只写入 `users` 表，密码保存为哈希值。
2. 登录使用 `username` 或 `email` + 密码。
3. 登录成功后返回 `access token` 和 `refresh token`。
4. `access token` 走 JWT，短有效期，不落库。
5. `refresh token` 落库到独立会话表，便于退出登录和多端管理。

这样做的好处是：

- 用户资料和登录态分离。
- 退出登录可以精确撤销某一个会话。
- 以后加“记住我”“多设备登录”“强制下线”都不需要改主用户表。

## 4. 表清单

- `users`
- `auth_sessions`
- `categories`
- `tags`
- `articles`
- `article_tags`
- `comments`
- `media_assets`

## 5. 表结构

### 5.1 users

博客后台用户表。适合管理员、作者等账号。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | bigint unsigned | PK | 主键 |
| username | varchar(64) | not null, unique | 登录名 |
| nickname | varchar(64) | not null | 显示名 |
| email | varchar(128) | not null, unique | 邮箱 |
| password_hash | varchar(255) | not null | 密码哈希 |
| avatar_url | varchar(500) | not null, default '' | 头像地址 |
| bio | varchar(500) | not null, default '' | 个人简介 |
| role | tinyint unsigned | not null, default 2 | 1=管理员, 2=作者 |
| status | tinyint unsigned | not null, default 1 | 1=正常, 0=禁用 |
| last_login_at | datetime | null | 最后登录时间 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |
| deleted_at | datetime | null | 软删除时间 |

索引建议：

- `uk_users_username(username)`
- `uk_users_email(email)`

说明：

- 这里同时承担“注册账号”和“登录身份”两种职责。
- 不建议把登录态直接放进 `users`，否则后续单点登出和多端管理会很别扭。

### 5.2 auth_sessions

登录会话表，保存刷新令牌和会话状态。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | bigint unsigned | PK | 主键 |
| user_id | bigint unsigned | not null, indexed | 归属用户 |
| refresh_token_hash | varchar(255) | not null, unique | 刷新令牌哈希 |
| expires_at | datetime | not null, indexed | 过期时间 |
| revoked_at | datetime | null | 撤销时间 |
| last_used_at | datetime | null | 最近使用时间 |
| login_ip_hash | varchar(128) | not null, default '' | 登录 IP 哈希 |
| user_agent | varchar(255) | not null, default '' | 浏览器信息 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |

索引建议：

- `idx_auth_sessions_user_id(user_id)`
- `idx_auth_sessions_expires_at(expires_at)`
- `uk_auth_sessions_refresh_token_hash(refresh_token_hash)`

说明：

- 只存刷新令牌，不存 access token。
- 登录、刷新、退出都围绕这张表做。
- `login_ip_hash` 是为了保留审计能力，又不直接存明文敏感信息。
- 会话表不使用软删除，生命周期由 `expires_at` 和 `revoked_at` 表达。

### 5.3 categories

文章分类表。支持父子层级，但不强制做复杂树结构。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | bigint unsigned | PK | 主键 |
| parent_id | bigint unsigned | null, indexed | 父分类 |
| name | varchar(64) | not null | 分类名 |
| slug | varchar(80) | not null, unique | 路由标识 |
| description | varchar(255) | not null, default '' | 描述 |
| sort | int unsigned | not null, default 0 | 排序值 |
| status | tinyint unsigned | not null, default 1 | 1=启用, 0=停用 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |
| deleted_at | datetime | null | 软删除时间 |

索引建议：

- `idx_categories_parent_id(parent_id)`
- `uk_categories_slug(slug)`

说明：

- 只保留 `parent_id`，足够表达一级或多级分类。
- 不额外拆分类树表，避免过度设计。

### 5.4 tags

文章标签表。标签是文章的多对多辅助分类。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | bigint unsigned | PK | 主键 |
| name | varchar(64) | not null | 标签名 |
| slug | varchar(80) | not null, unique | 路由标识 |
| color | varchar(24) | not null, default '' | 标签色值 |
| status | tinyint unsigned | not null, default 1 | 1=启用, 0=停用 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |
| deleted_at | datetime | null | 软删除时间 |

索引建议：

- `uk_tags_slug(slug)`

### 5.5 articles

文章主表。内容字段单独放在这里，标签通过中间表关联。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | bigint unsigned | PK | 主键 |
| author_id | bigint unsigned | not null, indexed | 作者 |
| category_id | bigint unsigned | null, indexed | 分类 |
| title | varchar(200) | not null | 标题 |
| slug | varchar(220) | not null, unique | 文章标识 |
| summary | varchar(500) | not null, default '' | 摘要 |
| content | longtext | not null | 正文 |
| cover_url | varchar(500) | not null, default '' | 封面图 |
| status | tinyint unsigned | not null, default 0 | 0=草稿, 1=已发布, 2=隐藏 |
| is_top | boolean | not null, default false | 是否置顶 |
| allow_comment | boolean | not null, default true | 是否允许评论 |
| view_count | bigint unsigned | not null, default 0 | 浏览量 |
| comment_count | bigint unsigned | not null, default 0 | 评论数 |
| published_at | datetime | null, indexed | 发布时间 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |
| deleted_at | datetime | null | 软删除时间 |

索引建议：

- `uk_articles_slug(slug)`
- `idx_articles_author_id(author_id)`
- `idx_articles_category_id(category_id)`
- `idx_articles_status_published_at(status, published_at)`

说明：

- `view_count` 和 `comment_count` 作为冗余字段保留，便于列表页直接读取。
- `slug` 用于文章详情页路由，建议全站唯一。
- `status` 用整数，后续加新状态更方便。

### 5.6 article_tags

文章和标签的中间表。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| article_id | bigint unsigned | PK, indexed | 文章 ID |
| tag_id | bigint unsigned | PK, indexed | 标签 ID |
| created_at | datetime | not null | 关联时间 |

索引建议：

- 复合主键 `PRIMARY KEY(article_id, tag_id)`
- `idx_article_tags_tag_id(tag_id)`

说明：

- 这是标准多对多结构，后续文章改标签不会影响主表。

### 5.7 comments

评论表，支持文章下的楼中楼回复。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | bigint unsigned | PK | 主键 |
| article_id | bigint unsigned | not null, indexed | 文章 |
| parent_id | bigint unsigned | null, indexed | 父评论 |
| user_id | bigint unsigned | null, indexed | 登录用户 |
| author_name | varchar(80) | not null | 评论者名称 |
| author_email | varchar(128) | not null, default '' | 评论者邮箱 |
| author_site | varchar(255) | not null, default '' | 个人站点 |
| content | text | not null | 评论内容 |
| ip_hash | varchar(128) | not null, default '' | IP 哈希 |
| user_agent | varchar(255) | not null, default '' | UA 信息 |
| status | tinyint unsigned | not null, default 0 | 0=待审, 1=通过, 2=拒绝, 3=垃圾 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |
| deleted_at | datetime | null | 软删除时间 |

索引建议：

- `idx_comments_article_id(article_id)`
- `idx_comments_parent_id(parent_id)`
- `idx_comments_user_id(user_id)`
- `idx_comments_article_status(article_id, status)`

说明：

- 允许匿名评论，所以 `user_id` 设为可空。
- `author_name` 等快照字段要保留，避免用户改名后历史评论失真。

### 5.8 media_assets

媒体资源表，统一管理图片、附件等文件。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | bigint unsigned | PK | 主键 |
| uploader_id | bigint unsigned | null, indexed | 上传者 |
| original_name | varchar(255) | not null | 原始文件名 |
| file_name | varchar(255) | not null | 存储文件名 |
| mime_type | varchar(100) | not null, default '' | MIME 类型 |
| size | bigint unsigned | not null, default 0 | 文件大小 |
| storage_type | tinyint unsigned | not null, default 1 | 1=本地, 2=对象存储 |
| path | varchar(500) | not null | 存储路径 |
| url | varchar(500) | not null | 访问地址 |
| hash | varchar(128) | not null, default '' | 文件哈希 |
| width | int unsigned | not null, default 0 | 宽度 |
| height | int unsigned | not null, default 0 | 高度 |
| status | tinyint unsigned | not null, default 1 | 1=可用, 0=禁用 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |
| deleted_at | datetime | null | 软删除时间 |

索引建议：

- `idx_media_assets_uploader_id(uploader_id)`
- `idx_media_assets_hash(hash)`

说明：

- 文件是否去重可以交给业务层处理，表里只保留 `hash` 方便查询。
- 如果后面接 OSS/S3，只改 `storage_type` 和 `path/url` 的生成规则即可。

## 6. 关系说明

1. `users 1 - n auth_sessions`
2. `users 1 - n articles`
3. `categories 1 - n articles`
4. `articles n - n tags`，通过 `article_tags`
5. `articles 1 - n comments`
6. `comments` 支持自关联回复树
7. `users 1 - n media_assets`

## 7. 推荐的 Gorm 模型

下面这套模型可以直接配合 `AutoMigrate()` 使用。

```go
package model

import (
	"time"

	"gorm.io/gorm"
)

type BaseModel struct {
	ID        uint64         `gorm:"primaryKey;autoIncrement;type:bigint unsigned" json:"id"`
	CreatedAt  time.Time      `gorm:"not null" json:"created_at"`
	UpdatedAt  time.Time      `gorm:"not null" json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

type User struct {
	BaseModel

	Username     string     `gorm:"type:varchar(64);not null;uniqueIndex:uk_users_username" json:"username"`
	Nickname     string     `gorm:"type:varchar(64);not null" json:"nickname"`
	Email        string     `gorm:"type:varchar(128);not null;uniqueIndex:uk_users_email" json:"email"`
	PasswordHash string     `gorm:"type:varchar(255);not null" json:"-"`
	AvatarURL    string     `gorm:"type:varchar(500);not null;default:''" json:"avatar_url"`
	Bio          string     `gorm:"type:varchar(500);not null;default:''" json:"bio"`
	Role         uint8      `gorm:"type:tinyint unsigned;not null;default:2" json:"role"`
	Status       uint8      `gorm:"type:tinyint unsigned;not null;default:1" json:"status"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
}

type AuthSession struct {
	ID               uint64     `gorm:"primaryKey;autoIncrement;type:bigint unsigned" json:"id"`
	UserID           uint64     `gorm:"type:bigint unsigned;not null;index:idx_auth_sessions_user_id" json:"user_id"`
	RefreshTokenHash string     `gorm:"type:varchar(255);not null;uniqueIndex:uk_auth_sessions_refresh_token_hash" json:"-"`
	ExpiresAt        time.Time   `gorm:"type:datetime;not null;index:idx_auth_sessions_expires_at" json:"expires_at"`
	RevokedAt        *time.Time  `json:"revoked_at,omitempty"`
	LastUsedAt       *time.Time  `json:"last_used_at,omitempty"`
	LoginIPHash      string      `gorm:"type:varchar(128);not null;default:''" json:"login_ip_hash"`
	UserAgent        string      `gorm:"type:varchar(255);not null;default:''" json:"user_agent"`
	CreatedAt        time.Time   `gorm:"not null" json:"created_at"`
	UpdatedAt        time.Time   `gorm:"not null" json:"updated_at"`

	User User `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

type Category struct {
	BaseModel

	ParentID    *uint64 `gorm:"type:bigint unsigned;index:idx_categories_parent_id" json:"parent_id,omitempty"`
	Name        string  `gorm:"type:varchar(64);not null" json:"name"`
	Slug        string  `gorm:"type:varchar(80);not null;uniqueIndex:uk_categories_slug" json:"slug"`
	Description string  `gorm:"type:varchar(255);not null;default:''" json:"description"`
	Sort        uint    `gorm:"type:int unsigned;not null;default:0" json:"sort"`
	Status      uint8   `gorm:"type:tinyint unsigned;not null;default:1" json:"status"`
}

type Tag struct {
	BaseModel

	Name   string `gorm:"type:varchar(64);not null" json:"name"`
	Slug   string `gorm:"type:varchar(80);not null;uniqueIndex:uk_tags_slug" json:"slug"`
	Color  string `gorm:"type:varchar(24);not null;default:''" json:"color"`
	Status uint8  `gorm:"type:tinyint unsigned;not null;default:1" json:"status"`
}

type Article struct {
	BaseModel

	AuthorID      uint64     `gorm:"type:bigint unsigned;not null;index:idx_articles_author_id" json:"author_id"`
	CategoryID    *uint64    `gorm:"type:bigint unsigned;index:idx_articles_category_id" json:"category_id,omitempty"`
	Title         string     `gorm:"type:varchar(200);not null" json:"title"`
	Slug          string     `gorm:"type:varchar(220);not null;uniqueIndex:uk_articles_slug" json:"slug"`
	Summary       string     `gorm:"type:varchar(500);not null;default:''" json:"summary"`
	Content       string     `gorm:"type:longtext;not null" json:"content"`
	CoverURL      string     `gorm:"type:varchar(500);not null;default:''" json:"cover_url"`
	Status        uint8      `gorm:"type:tinyint unsigned;not null;default:0;index:idx_articles_status_published_at,priority:1" json:"status"`
	IsTop         bool       `gorm:"type:boolean;not null;default:false" json:"is_top"`
	AllowComment  bool       `gorm:"type:boolean;not null;default:true" json:"allow_comment"`
	ViewCount     uint64     `gorm:"type:bigint unsigned;not null;default:0" json:"view_count"`
	CommentCount  uint64     `gorm:"type:bigint unsigned;not null;default:0" json:"comment_count"`
	PublishedAt   *time.Time `gorm:"index:idx_articles_status_published_at,priority:2" json:"published_at,omitempty"`

	Author   User      `gorm:"foreignKey:AuthorID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"author"`
	Category *Category `gorm:"foreignKey:CategoryID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"category,omitempty"`
	Tags     []Tag     `gorm:"many2many:article_tags;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"tags,omitempty"`
}

type ArticleTag struct {
	ArticleID uint64    `gorm:"primaryKey;type:bigint unsigned" json:"article_id"`
	TagID     uint64    `gorm:"primaryKey;type:bigint unsigned" json:"tag_id"`
	CreatedAt time.Time `gorm:"not null" json:"created_at"`
}

type Comment struct {
	BaseModel

	ArticleID   uint64     `gorm:"type:bigint unsigned;not null;index:idx_comments_article_status,priority:1;index:idx_comments_article_id" json:"article_id"`
	ParentID    *uint64    `gorm:"type:bigint unsigned;index:idx_comments_parent_id" json:"parent_id,omitempty"`
	UserID      *uint64    `gorm:"type:bigint unsigned;index:idx_comments_user_id" json:"user_id,omitempty"`
	AuthorName  string     `gorm:"type:varchar(80);not null" json:"author_name"`
	AuthorEmail string     `gorm:"type:varchar(128);not null;default:''" json:"author_email"`
	AuthorSite  string     `gorm:"type:varchar(255);not null;default:''" json:"author_site"`
	Content     string     `gorm:"type:text;not null" json:"content"`
	IPHash      string     `gorm:"type:varchar(128);not null;default:''" json:"ip_hash"`
	UserAgent   string     `gorm:"type:varchar(255);not null;default:''" json:"user_agent"`
	Status      uint8      `gorm:"type:tinyint unsigned;not null;default:0;index:idx_comments_article_status,priority:2" json:"status"`

	Article Article  `gorm:"foreignKey:ArticleID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Parent  *Comment `gorm:"foreignKey:ParentID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"-"`
	User    *User    `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"user,omitempty"`
}

type MediaAsset struct {
	BaseModel

	UploaderID   *uint64 `gorm:"type:bigint unsigned;index:idx_media_assets_uploader_id" json:"uploader_id,omitempty"`
	OriginalName string  `gorm:"type:varchar(255);not null" json:"original_name"`
	FileName     string  `gorm:"type:varchar(255);not null" json:"file_name"`
	MimeType     string  `gorm:"type:varchar(100);not null;default:''" json:"mime_type"`
	Size         uint64  `gorm:"type:bigint unsigned;not null;default:0" json:"size"`
	StorageType  uint8   `gorm:"type:tinyint unsigned;not null;default:1" json:"storage_type"`
	Path         string  `gorm:"type:varchar(500);not null" json:"path"`
	URL          string  `gorm:"type:varchar(500);not null" json:"url"`
	Hash         string  `gorm:"type:varchar(128);not null;default:'';index:idx_media_assets_hash" json:"hash"`
	Width        uint    `gorm:"type:int unsigned;not null;default:0" json:"width"`
	Height       uint    `gorm:"type:int unsigned;not null;default:0" json:"height"`
	Status       uint8   `gorm:"type:tinyint unsigned;not null;default:1" json:"status"`
}
```

## 8. 建表顺序

建议按以下顺序执行 `AutoMigrate()`：

1. `User`
2. `AuthSession`
3. `Category`
4. `Tag`
5. `Article`
6. `ArticleTag`
7. `Comment`
8. `MediaAsset`

示例：

```go
func AutoMigrate(db *gorm.DB) error {
	if err := db.SetupJoinTable(&Article{}, "Tags", &ArticleTag{}); err != nil {
		return err
	}

	return db.AutoMigrate(
		&User{},
		&AuthSession{},
		&Category{},
		&Tag{},
		&Article{},
		&ArticleTag{},
		&Comment{},
		&MediaAsset{},
	)
}
```

实际项目里，建议只在独立迁移命令中执行这段逻辑，正常启动服务不要自动建表。

## 9. 约束说明

1. `slug` 字段适合做 URL 标识，建议全站唯一。
2. 软删除启用后，唯一键是否允许复用要提前定死；这份方案默认不复用旧 `slug`。
3. `refresh_token_hash` 必须存哈希，不存明文刷新令牌。
4. 评论表保留作者快照字段，避免历史内容被用户资料变更影响。
5. 计数字段建议由业务层维护，不建议每次列表查询现算。
6. 如果后续要做站内搜索，可以在 `articles` 上加全文索引，不必提前拆表。
7. 文章标签中间表使用 `SetupJoinTable` 注册后再迁移，才能保留 `created_at`。

## 10. 后续可扩展项

如果后面需要增强，可以在不破坏现有结构的前提下再加：

- `password_reset_tokens` 密码重置表
- `email_verification_codes` 邮箱验证表
- `article_views` 访问明细表
- `user_followers` 关注关系表
- `article_likes` 点赞表
- `site_settings` 站点配置表
- `attachments` 更细的文件扩展表

这些都不属于当前基础博客的必需项，所以这版没有先放进去。
