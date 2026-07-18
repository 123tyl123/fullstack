package router

import (
	"strings"

	"backend/internal/config"
	"backend/internal/handler"
	"backend/internal/response"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func New(cfg config.Config, db *gorm.DB) *gin.Engine {
	setGinMode(cfg.AppEnv)

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	authHandler := handler.NewAuthHandler(service.NewAuthService(db, cfg))

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

		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}
	}

	return r
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
