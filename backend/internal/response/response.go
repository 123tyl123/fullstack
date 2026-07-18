package response

import "github.com/gin-gonic/gin"

type Body struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

func JSON(c *gin.Context, httpStatus int, body Body) {
	c.JSON(httpStatus, body)
}

func OK(c *gin.Context, data any) {
	JSON(c, 200, Body{
		Code:    0,
		Message: "ok",
		Data:    data,
	})
}

func Fail(c *gin.Context, httpStatus int, message string) {
	JSON(c, httpStatus, Body{
		Code:    httpStatus,
		Message: message,
	})
}
