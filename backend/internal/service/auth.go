package service

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"backend/internal/auth"
	"backend/internal/config"
	"backend/internal/model"

	"github.com/go-sql-driver/mysql"
	"gorm.io/gorm"
)

var (
	ErrInvalidInput       = errors.New("invalid input")
	ErrUserExists         = errors.New("user already exists")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserDisabled       = errors.New("user disabled")
)

type ClientInfo struct {
	IP        string
	UserAgent string
}

type RegisterRequest struct {
	Username string `json:"username"`
	Nickname string `json:"nickname"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Account  string `json:"account"`
	Password string `json:"password"`
}

type UserDTO struct {
	ID          uint64     `json:"id"`
	Username    string     `json:"username"`
	Nickname    string     `json:"nickname"`
	Email       string     `json:"email"`
	AvatarURL   string     `json:"avatar_url"`
	Bio         string     `json:"bio"`
	Role        uint8      `json:"role"`
	Status      uint8      `json:"status"`
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
}

type AuthResponse struct {
	TokenType        string    `json:"token_type"`
	AccessToken      string    `json:"access_token"`
	ExpiresIn        int64     `json:"expires_in"`
	RefreshToken     string    `json:"refresh_token"`
	RefreshExpiresAt time.Time `json:"refresh_expires_at"`
	User             UserDTO   `json:"user"`
}

type AuthService struct {
	db  *gorm.DB
	cfg config.Config
}

func NewAuthService(db *gorm.DB, cfg config.Config) *AuthService {
	return &AuthService{db: db, cfg: cfg}
}

func (s *AuthService) Register(ctx context.Context, req RegisterRequest, client ClientInfo) (*AuthResponse, error) {
	req.normalize()
	if err := req.validate(); err != nil {
		return nil, err
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	now := time.Now().UTC()
	var user model.User
	var response *AuthResponse

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing int64
		if err := tx.Model(&model.User{}).
			Where("username = ? OR email = ?", req.Username, req.Email).
			Count(&existing).Error; err != nil {
			return fmt.Errorf("check user exists: %w", err)
		}
		if existing > 0 {
			return ErrUserExists
		}

		user = model.User{
			Username:     req.Username,
			Nickname:     chooseNickname(req.Nickname, req.Username),
			Email:        req.Email,
			PasswordHash: hash,
			AvatarURL:    "",
			Bio:          "",
			Role:         model.UserRoleAuthor,
			Status:       model.UserStatusEnabled,
			LastLoginAt:  &now,
		}

		if err := tx.Create(&user).Error; err != nil {
			if isDuplicateKey(err) {
				return ErrUserExists
			}
			return fmt.Errorf("create user: %w", err)
		}

		resp, err := s.issueAuthResponse(tx, user, client)
		if err != nil {
			return err
		}
		response = resp
		return nil
	})
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (s *AuthService) Login(ctx context.Context, req LoginRequest, client ClientInfo) (*AuthResponse, error) {
	req.normalize()
	if err := req.validate(); err != nil {
		return nil, err
	}

	var user model.User
	err := s.db.WithContext(ctx).
		Where("username = ? OR email = ?", req.Account, req.Account).
		First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("find user: %w", err)
	}

	if user.Status != model.UserStatusEnabled {
		return nil, ErrUserDisabled
	}

	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		return nil, ErrInvalidCredentials
	}

	var response *AuthResponse
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		if err := tx.Model(&model.User{}).
			Where("id = ?", user.ID).
			Update("last_login_at", now).Error; err != nil {
			return fmt.Errorf("update last login: %w", err)
		}
		user.LastLoginAt = &now

		resp, err := s.issueAuthResponse(tx, user, client)
		if err != nil {
			return err
		}
		response = resp
		return nil
	})
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (s *AuthService) issueAuthResponse(tx *gorm.DB, user model.User, client ClientInfo) (*AuthResponse, error) {
	accessTTL := time.Duration(s.cfg.JWTAccessTTLMinutes) * time.Minute
	refreshTTL := time.Duration(s.cfg.JWTRefreshTTLHours) * time.Hour
	now := time.Now().UTC()

	accessToken, err := auth.GenerateAccessToken(s.cfg.JWTAccessSecret, accessTTL, user)
	if err != nil {
		return nil, fmt.Errorf("generate access token: %w", err)
	}

	refreshToken, err := auth.GenerateRefreshToken()
	if err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}

	session := model.AuthSession{
		UserID:           user.ID,
		RefreshTokenHash: auth.HashString(refreshToken),
		ExpiresAt:        now.Add(refreshTTL),
		LastUsedAt:       &now,
		LoginIPHash:      auth.HashString(client.IP),
		UserAgent:        limitString(client.UserAgent, 255),
	}

	if err := tx.Create(&session).Error; err != nil {
		return nil, fmt.Errorf("create auth session: %w", err)
	}

	return &AuthResponse{
		TokenType:        "Bearer",
		AccessToken:      accessToken,
		ExpiresIn:        int64(accessTTL.Seconds()),
		RefreshToken:     refreshToken,
		RefreshExpiresAt: session.ExpiresAt,
		User:             toUserDTO(user),
	}, nil
}

func (r *RegisterRequest) normalize() {
	r.Username = strings.TrimSpace(r.Username)
	r.Nickname = strings.TrimSpace(r.Nickname)
	r.Email = strings.ToLower(strings.TrimSpace(r.Email))
	if r.Nickname == "" {
		r.Nickname = r.Username
	}
}

func (r *RegisterRequest) validate() error {
	if runeLen(r.Username) < 3 || runeLen(r.Username) > 64 {
		return fmt.Errorf("%w: username length must be between 3 and 64", ErrInvalidInput)
	}
	if runeLen(r.Nickname) == 0 || runeLen(r.Nickname) > 64 {
		return fmt.Errorf("%w: nickname length must be between 1 and 64", ErrInvalidInput)
	}
	address, err := mail.ParseAddress(r.Email)
	if err != nil || address.Address != r.Email {
		return fmt.Errorf("%w: invalid email", ErrInvalidInput)
	}
	if len(r.Password) < 8 || len(r.Password) > 72 {
		return fmt.Errorf("%w: password length must be between 8 and 72 bytes", ErrInvalidInput)
	}
	if strings.ContainsAny(r.Username, " \t\r\n") {
		return fmt.Errorf("%w: username cannot contain whitespace", ErrInvalidInput)
	}
	return nil
}

func (r *LoginRequest) normalize() {
	r.Account = strings.TrimSpace(r.Account)
	if strings.Contains(r.Account, "@") {
		r.Account = strings.ToLower(r.Account)
	}
}

func (r *LoginRequest) validate() error {
	if r.Account == "" {
		return fmt.Errorf("%w: account is required", ErrInvalidInput)
	}
	if len(r.Password) < 8 || len(r.Password) > 72 {
		return fmt.Errorf("%w: password length must be between 8 and 72 bytes", ErrInvalidInput)
	}
	return nil
}

func chooseNickname(nickname, username string) string {
	if strings.TrimSpace(nickname) != "" {
		return nickname
	}
	return username
}

func runeLen(value string) int {
	return utf8.RuneCountInString(value)
}

func limitString(value string, max int) string {
	if len(value) <= max {
		return value
	}
	return value[:max]
}

func toUserDTO(user model.User) UserDTO {
	return UserDTO{
		ID:          user.ID,
		Username:    user.Username,
		Nickname:    user.Nickname,
		Email:       user.Email,
		AvatarURL:   user.AvatarURL,
		Bio:         user.Bio,
		Role:        user.Role,
		Status:      user.Status,
		LastLoginAt: user.LastLoginAt,
	}
}

func isDuplicateKey(err error) bool {
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) {
		return mysqlErr.Number == 1062
	}
	return false
}
