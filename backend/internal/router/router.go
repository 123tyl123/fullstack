package router

import (
	"strings"

	"backend/internal/config"
	"backend/internal/handler"
	"backend/internal/middleware"
	"backend/internal/response"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func New(cfg config.Config, db *gorm.DB) *gin.Engine {
	setGinMode(cfg.AppEnv)

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.MaxMultipartMemory = int64(maxInt(cfg.AvatarMaxSizeMB, 5)) << 20

	authHandler := handler.NewAuthHandler(service.NewAuthService(db, cfg))
	profileHandler := handler.NewProfileHandler(service.NewProfileService(db, cfg))

	api := r.Group("/api")
	{
		api.GET("", func(c *gin.Context) {
			response.OK(c, gin.H{
				"message": "backend is running",
			})
		})
		api.GET("/test", func(ctx *gin.Context) {
			response.OK(ctx, gin.H{
				"message": "backendtest",
			})
		})
		api.GET("/health", handler.Health(db))
		api.Static("/uploads", cfg.UploadDir)

		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		users := api.Group("/users", middleware.AuthRequired(cfg))
		{
			users.GET("/me", profileHandler.Me)
			users.PUT("/me", profileHandler.Update)
			users.POST("/me/avatar", profileHandler.UploadAvatar)
		}
	}

	return r
}

func maxInt(left, right int) int {
	if left > right {
		return left
	}
	return right
}

func setGinMode(appEnv string) {
	switch strings.ToLower(appEnv) {
	case "release", "prod", "production":
		gin.SetMode(gin.ReleaseMode)
	case "test":
		gin.SetMode(gin.TestMode)
	default:
		gin.SetMode(gin.DebugMode)
	}
}
