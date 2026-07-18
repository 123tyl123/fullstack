package handler

import (
	"errors"
	"net/http"

	"backend/internal/middleware"
	"backend/internal/response"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
)

type ProfileHandler struct {
	svc *service.ProfileService
}

func NewProfileHandler(svc *service.ProfileService) *ProfileHandler {
	return &ProfileHandler{svc: svc}
}

func (h *ProfileHandler) Me(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "missing current user")
		return
	}

	result, err := h.svc.CurrentUser(c.Request.Context(), userID)
	if err != nil {
		writeProfileError(c, err)
		return
	}

	response.OK(c, result)
}

func (h *ProfileHandler) Update(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "missing current user")
		return
	}

	var req service.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid request body")
		return
	}

	result, err := h.svc.UpdateProfile(c.Request.Context(), userID, req)
	if err != nil {
		writeProfileError(c, err)
		return
	}

	response.OK(c, result)
}

func (h *ProfileHandler) UploadAvatar(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "missing current user")
		return
	}

	file, err := c.FormFile("avatar")
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "avatar file is required")
		return
	}

	result, err := h.svc.UploadAvatar(c.Request.Context(), userID, file)
	if err != nil {
		writeProfileError(c, err)
		return
	}

	response.OK(c, result)
}

func writeProfileError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrInvalidInput):
		response.Fail(c, http.StatusBadRequest, err.Error())
	case errors.Is(err, service.ErrUserExists):
		response.Fail(c, http.StatusConflict, "username or email already exists")
	case errors.Is(err, service.ErrUnsupportedFileType):
		response.Fail(c, http.StatusBadRequest, "unsupported avatar file type")
	case errors.Is(err, service.ErrFileTooLarge):
		response.Fail(c, http.StatusRequestEntityTooLarge, "avatar file too large")
	case errors.Is(err, service.ErrUserNotFound):
		response.Fail(c, http.StatusNotFound, "user not found")
	case errors.Is(err, service.ErrUserDisabled):
		response.Fail(c, http.StatusForbidden, "user disabled")
	default:
		response.Fail(c, http.StatusInternalServerError, "internal server error")
	}
}
