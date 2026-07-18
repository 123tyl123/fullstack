package handler

import (
	"errors"
	"net/http"

	"backend/internal/response"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	svc *service.AuthService
}

func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req service.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid request body")
		return
	}

	result, err := h.svc.Register(c.Request.Context(), req, service.ClientInfo{
		IP:        c.ClientIP(),
		UserAgent: c.GetHeader("User-Agent"),
	})
	if err != nil {
		writeAuthError(c, err)
		return
	}

	response.OK(c, result)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req service.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid request body")
		return
	}

	result, err := h.svc.Login(c.Request.Context(), req, service.ClientInfo{
		IP:        c.ClientIP(),
		UserAgent: c.GetHeader("User-Agent"),
	})
	if err != nil {
		writeAuthError(c, err)
		return
	}

	response.OK(c, result)
}

func writeAuthError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrInvalidInput):
		response.Fail(c, http.StatusBadRequest, err.Error())
	case errors.Is(err, service.ErrUserExists):
		response.Fail(c, http.StatusConflict, "user already exists")
	case errors.Is(err, service.ErrInvalidCredentials):
		response.Fail(c, http.StatusUnauthorized, "invalid credentials")
	case errors.Is(err, service.ErrUserDisabled):
		response.Fail(c, http.StatusForbidden, "user disabled")
	default:
		response.Fail(c, http.StatusInternalServerError, "internal server error")
	}
}
