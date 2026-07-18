package middleware

import (
	"net/http"
	"strconv"
	"strings"

	"backend/internal/auth"
	"backend/internal/config"
	"backend/internal/response"

	"github.com/gin-gonic/gin"
)

const (
	ContextUserIDKey   = "user_id"
	ContextUsernameKey = "username"
	ContextRoleKey     = "role"
)

func AuthRequired(cfg config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := bearerToken(c.GetHeader("Authorization"))
		if token == "" {
			response.Fail(c, http.StatusUnauthorized, "missing authorization token")
			c.Abort()
			return
		}

		claims, err := auth.ParseAccessToken(cfg.JWTAccessSecret, token)
		if err != nil {
			response.Fail(c, http.StatusUnauthorized, "invalid authorization token")
			c.Abort()
			return
		}

		c.Set(ContextUserIDKey, claims.UserID)
		c.Set(ContextUsernameKey, claims.Username)
		c.Set(ContextRoleKey, claims.Role)
		c.Next()
	}
}

func CurrentUserID(c *gin.Context) (uint64, bool) {
	value, exists := c.Get(ContextUserIDKey)
	if !exists {
		return 0, false
	}

	switch typed := value.(type) {
	case uint64:
		return typed, true
	case uint:
		return uint64(typed), true
	case int:
		if typed < 0 {
			return 0, false
		}
		return uint64(typed), true
	case string:
		parsed, err := strconv.ParseUint(typed, 10, 64)
		return parsed, err == nil
	default:
		return 0, false
	}
}

func bearerToken(header string) string {
	parts := strings.Fields(header)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}

	return parts[1]
}
