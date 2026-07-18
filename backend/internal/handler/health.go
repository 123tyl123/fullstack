package handler

import (
	"net/http"

	"backend/internal/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func Health(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		sqlDB, err := db.DB()
		if err != nil {
			response.JSON(c, http.StatusServiceUnavailable, response.Body{
				Code:    http.StatusServiceUnavailable,
				Message: "database unavailable",
			})
			return
		}

		if err := sqlDB.PingContext(c.Request.Context()); err != nil {
			response.JSON(c, http.StatusServiceUnavailable, response.Body{
				Code:    http.StatusServiceUnavailable,
				Message: "database ping failed",
			})
			return
		}

		response.OK(c, gin.H{
			"status":   "ok",
			"database": "ok",
		})
	}
}
