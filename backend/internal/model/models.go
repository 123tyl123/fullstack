package model

import (
	"time"

	"gorm.io/gorm"
)

const (
	UserStatusDisabled uint8 = 0
	UserStatusEnabled  uint8 = 1

	UserRoleAdmin  uint8 = 1
	UserRoleAuthor uint8 = 2

	StorageTypeLocal uint8 = 1

	MediaStatusEnabled uint8 = 1
)

type BaseModel struct {
	ID        uint64         `gorm:"primaryKey;autoIncrement;type:bigint unsigned" json:"id"`
	CreatedAt time.Time      `gorm:"type:datetime;not null" json:"created_at"`
	UpdatedAt time.Time      `gorm:"type:datetime;not null" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"type:datetime;index" json:"-"`
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
	LastLoginAt  *time.Time `gorm:"type:datetime" json:"last_login_at,omitempty"`
}

type AuthSession struct {
	ID               uint64     `gorm:"primaryKey;autoIncrement;type:bigint unsigned" json:"id"`
	UserID           uint64     `gorm:"type:bigint unsigned;not null;index:idx_auth_sessions_user_id" json:"user_id"`
	RefreshTokenHash string     `gorm:"type:varchar(255);not null;uniqueIndex:uk_auth_sessions_refresh_token_hash" json:"-"`
	ExpiresAt        time.Time  `gorm:"type:datetime;not null;index:idx_auth_sessions_expires_at" json:"expires_at"`
	RevokedAt        *time.Time `gorm:"type:datetime" json:"revoked_at,omitempty"`
	LastUsedAt       *time.Time `gorm:"type:datetime" json:"last_used_at,omitempty"`
	LoginIPHash      string     `gorm:"type:varchar(128);not null;default:''" json:"login_ip_hash"`
	UserAgent        string     `gorm:"type:varchar(255);not null;default:''" json:"user_agent"`
	CreatedAt        time.Time  `gorm:"type:datetime;not null" json:"created_at"`
	UpdatedAt        time.Time  `gorm:"type:datetime;not null" json:"updated_at"`

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

	AuthorID     uint64     `gorm:"type:bigint unsigned;not null;index:idx_articles_author_id" json:"author_id"`
	CategoryID   *uint64    `gorm:"type:bigint unsigned;index:idx_articles_category_id" json:"category_id,omitempty"`
	Title        string     `gorm:"type:varchar(200);not null" json:"title"`
	Slug         string     `gorm:"type:varchar(220);not null;uniqueIndex:uk_articles_slug" json:"slug"`
	Summary      string     `gorm:"type:varchar(500);not null;default:''" json:"summary"`
	Content      string     `gorm:"type:longtext;not null" json:"content"`
	CoverURL     string     `gorm:"type:varchar(500);not null;default:''" json:"cover_url"`
	Status       uint8      `gorm:"type:tinyint unsigned;not null;default:0;index:idx_articles_status_published_at,priority:1" json:"status"`
	IsTop        bool       `gorm:"type:boolean;not null;default:false" json:"is_top"`
	AllowComment bool       `gorm:"type:boolean;not null;default:true" json:"allow_comment"`
	ViewCount    uint64     `gorm:"type:bigint unsigned;not null;default:0" json:"view_count"`
	CommentCount uint64     `gorm:"type:bigint unsigned;not null;default:0" json:"comment_count"`
	PublishedAt  *time.Time `gorm:"type:datetime;index:idx_articles_status_published_at,priority:2" json:"published_at,omitempty"`

	Author   User      `gorm:"foreignKey:AuthorID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"author"`
	Category *Category `gorm:"foreignKey:CategoryID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"category,omitempty"`
	Tags     []Tag     `gorm:"many2many:article_tags;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"tags,omitempty"`
}

type ArticleTag struct {
	ArticleID uint64    `gorm:"primaryKey;type:bigint unsigned" json:"article_id"`
	TagID     uint64    `gorm:"primaryKey;type:bigint unsigned;index:idx_article_tags_tag_id" json:"tag_id"`
	CreatedAt time.Time `gorm:"type:datetime;not null" json:"created_at"`
}

type Comment struct {
	BaseModel

	ArticleID   uint64  `gorm:"type:bigint unsigned;not null;index:idx_comments_article_status,priority:1;index:idx_comments_article_id" json:"article_id"`
	ParentID    *uint64 `gorm:"type:bigint unsigned;index:idx_comments_parent_id" json:"parent_id,omitempty"`
	UserID      *uint64 `gorm:"type:bigint unsigned;index:idx_comments_user_id" json:"user_id,omitempty"`
	AuthorName  string  `gorm:"type:varchar(80);not null" json:"author_name"`
	AuthorEmail string  `gorm:"type:varchar(128);not null;default:''" json:"author_email"`
	AuthorSite  string  `gorm:"type:varchar(255);not null;default:''" json:"author_site"`
	Content     string  `gorm:"type:text;not null" json:"content"`
	IPHash      string  `gorm:"type:varchar(128);not null;default:''" json:"ip_hash"`
	UserAgent   string  `gorm:"type:varchar(255);not null;default:''" json:"user_agent"`
	Status      uint8   `gorm:"type:tinyint unsigned;not null;default:0;index:idx_comments_article_status,priority:2" json:"status"`

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
