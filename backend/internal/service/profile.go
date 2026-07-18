package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/mail"
	"os"
	"path/filepath"
	"strings"
	"time"

	"backend/internal/config"
	"backend/internal/model"

	"gorm.io/gorm"
)

var (
	ErrUserNotFound        = errors.New("user not found")
	ErrUnsupportedFileType = errors.New("unsupported file type")
	ErrFileTooLarge        = errors.New("file too large")
)

type UpdateProfileRequest struct {
	Username *string `json:"username"`
	Nickname *string `json:"nickname"`
	Email    *string `json:"email"`
	Bio      *string `json:"bio"`
}

type AvatarResponse struct {
	AvatarURL string  `json:"avatar_url"`
	User      UserDTO `json:"user"`
}

type ProfileService struct {
	db  *gorm.DB
	cfg config.Config
}

func NewProfileService(db *gorm.DB, cfg config.Config) *ProfileService {
	return &ProfileService{db: db, cfg: cfg}
}

func (s *ProfileService) CurrentUser(ctx context.Context, userID uint64) (*UserDTO, error) {
	user, err := s.findActiveUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	dto := toUserDTO(user)
	return &dto, nil
}

func (s *ProfileService) UpdateProfile(ctx context.Context, userID uint64, req UpdateProfileRequest) (*UserDTO, error) {
	normalized, err := normalizeUpdateProfile(req)
	if err != nil {
		return nil, err
	}
	if len(normalized) == 0 {
		return nil, fmt.Errorf("%w: no profile fields to update", ErrInvalidInput)
	}

	var updated model.User
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := tx.First(&user, userID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrUserNotFound
			}
			return fmt.Errorf("find user: %w", err)
		}
		if user.Status != model.UserStatusEnabled {
			return ErrUserDisabled
		}

		if err := checkProfileConflict(tx, userID, normalized); err != nil {
			return err
		}

		if err := tx.Model(&model.User{}).Where("id = ?", userID).Updates(normalized).Error; err != nil {
			if isDuplicateKey(err) {
				return ErrUserExists
			}
			return fmt.Errorf("update profile: %w", err)
		}

		if err := tx.First(&updated, userID).Error; err != nil {
			return fmt.Errorf("load updated user: %w", err)
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	dto := toUserDTO(updated)
	return &dto, nil
}

func (s *ProfileService) UploadAvatar(ctx context.Context, userID uint64, fileHeader *multipart.FileHeader) (*AvatarResponse, error) {
	if fileHeader == nil {
		return nil, fmt.Errorf("%w: avatar file is required", ErrInvalidInput)
	}

	maxBytes := int64(s.cfg.AvatarMaxSizeMB) * 1024 * 1024
	if maxBytes <= 0 {
		maxBytes = 5 * 1024 * 1024
	}
	if fileHeader.Size <= 0 {
		return nil, fmt.Errorf("%w: avatar file is required", ErrInvalidInput)
	}
	if fileHeader.Size > maxBytes {
		return nil, ErrFileTooLarge
	}

	file, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("open avatar file: %w", err)
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, maxBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read avatar file: %w", err)
	}
	if int64(len(data)) > maxBytes {
		return nil, ErrFileTooLarge
	}

	contentType := http.DetectContentType(data)
	ext, ok := avatarExt(contentType)
	if !ok {
		return nil, ErrUnsupportedFileType
	}

	now := time.Now().UTC()
	relativeDir := filepath.Join("avatars", now.Format("2006"), now.Format("01"))
	fileName := randomFileName(ext)
	fullDir := filepath.Join(s.cfg.UploadDir, relativeDir)
	fullPath := filepath.Join(fullDir, fileName)

	if err := os.MkdirAll(fullDir, 0o755); err != nil {
		return nil, fmt.Errorf("create upload dir: %w", err)
	}
	if err := os.WriteFile(fullPath, data, 0o644); err != nil {
		return nil, fmt.Errorf("save avatar file: %w", err)
	}

	width, height := imageSize(data)
	urlPath := publicUploadURL(s.cfg.UploadPublicPath, filepath.ToSlash(filepath.Join(relativeDir, fileName)))
	hash := hashBytes(data)

	var updated model.User
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := tx.First(&user, userID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrUserNotFound
			}
			return fmt.Errorf("find user: %w", err)
		}
		if user.Status != model.UserStatusEnabled {
			return ErrUserDisabled
		}

		media := model.MediaAsset{
			UploaderID:   &user.ID,
			OriginalName: fileHeader.Filename,
			FileName:     fileName,
			MimeType:     contentType,
			Size:         uint64(len(data)),
			StorageType:  model.StorageTypeLocal,
			Path:         filepath.ToSlash(fullPath),
			URL:          urlPath,
			Hash:         hash,
			Width:        uint(width),
			Height:       uint(height),
			Status:       model.MediaStatusEnabled,
		}
		if err := tx.Create(&media).Error; err != nil {
			return fmt.Errorf("create media asset: %w", err)
		}

		if err := tx.Model(&model.User{}).
			Where("id = ?", userID).
			Update("avatar_url", urlPath).Error; err != nil {
			return fmt.Errorf("update avatar url: %w", err)
		}

		if err := tx.First(&updated, userID).Error; err != nil {
			return fmt.Errorf("load updated user: %w", err)
		}

		return nil
	})
	if err != nil {
		_ = os.Remove(fullPath)
		return nil, err
	}

	return &AvatarResponse{
		AvatarURL: urlPath,
		User:      toUserDTO(updated),
	}, nil
}

func (s *ProfileService) findActiveUser(ctx context.Context, userID uint64) (model.User, error) {
	var user model.User
	if err := s.db.WithContext(ctx).First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return model.User{}, ErrUserNotFound
		}
		return model.User{}, fmt.Errorf("find user: %w", err)
	}
	if user.Status != model.UserStatusEnabled {
		return model.User{}, ErrUserDisabled
	}

	return user, nil
}

func normalizeUpdateProfile(req UpdateProfileRequest) (map[string]any, error) {
	updates := make(map[string]any)

	if req.Username != nil {
		username := strings.TrimSpace(*req.Username)
		if runeLen(username) < 3 || runeLen(username) > 64 {
			return nil, fmt.Errorf("%w: username length must be between 3 and 64", ErrInvalidInput)
		}
		if strings.ContainsAny(username, " \t\r\n") {
			return nil, fmt.Errorf("%w: username cannot contain whitespace", ErrInvalidInput)
		}
		updates["username"] = username
	}

	if req.Nickname != nil {
		nickname := strings.TrimSpace(*req.Nickname)
		if runeLen(nickname) < 1 || runeLen(nickname) > 64 {
			return nil, fmt.Errorf("%w: nickname length must be between 1 and 64", ErrInvalidInput)
		}
		updates["nickname"] = nickname
	}

	if req.Email != nil {
		email := strings.ToLower(strings.TrimSpace(*req.Email))
		address, err := mail.ParseAddress(email)
		if err != nil || address.Address != email {
			return nil, fmt.Errorf("%w: invalid email", ErrInvalidInput)
		}
		updates["email"] = email
	}

	if req.Bio != nil {
		bio := strings.TrimSpace(*req.Bio)
		if runeLen(bio) > 500 {
			return nil, fmt.Errorf("%w: bio length must be at most 500", ErrInvalidInput)
		}
		updates["bio"] = bio
	}

	return updates, nil
}

func checkProfileConflict(tx *gorm.DB, userID uint64, updates map[string]any) error {
	var parts []string
	var args []any

	if username, ok := updates["username"]; ok {
		parts = append(parts, "username = ?")
		args = append(args, username)
	}
	if email, ok := updates["email"]; ok {
		parts = append(parts, "email = ?")
		args = append(args, email)
	}
	if len(parts) == 0 {
		return nil
	}

	var count int64
	if err := tx.Model(&model.User{}).
		Where("id <> ?", userID).
		Where("("+strings.Join(parts, " OR ")+")", args...).
		Count(&count).Error; err != nil {
		return fmt.Errorf("check profile conflict: %w", err)
	}
	if count > 0 {
		return ErrUserExists
	}

	return nil
}

func avatarExt(contentType string) (string, bool) {
	switch contentType {
	case "image/jpeg":
		return ".jpg", true
	case "image/png":
		return ".png", true
	case "image/gif":
		return ".gif", true
	case "image/webp":
		return ".webp", true
	default:
		return "", false
	}
}

func randomFileName(ext string) string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	}
	return hex.EncodeToString(buf) + ext
}

func publicUploadURL(prefix string, relative string) string {
	prefix = strings.TrimRight(prefix, "/")
	relative = strings.TrimLeft(relative, "/")
	return prefix + "/" + relative
}

func hashBytes(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func imageSize(data []byte) (int, int) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return 0, 0
	}
	return cfg.Width, cfg.Height
}
