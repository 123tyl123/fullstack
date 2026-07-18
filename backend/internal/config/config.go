package config

import (
	"net"
	"os"
	"strconv"
	"strings"

	"github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv     string
	ServerPort string

	DBHost                   string
	DBPort                   string
	DBUser                   string
	DBPassword               string
	DBName                   string
	DBCharset                string
	DBParseTime              string
	DBLoc                    string
	DBMaxIdleConns           int
	DBMaxOpenConns           int
	DBConnMaxLifetimeMinutes int
	JWTAccessSecret          string
	JWTAccessTTLMinutes      int
	JWTRefreshTTLHours       int
}

func Load() Config {
	loadDotEnv()

	return Config{
		AppEnv:     getEnv("APP_ENV", "debug"),
		ServerPort: getEnv("SERVER_PORT", "8080"),

		DBHost:                   getEnv("DB_HOST", "127.0.0.1"),
		DBPort:                   getEnv("DB_PORT", "3306"),
		DBUser:                   getEnv("DB_USER", "root"),
		DBPassword:               getEnv("DB_PASSWORD", "123456"),
		DBName:                   getEnv("DB_NAME", "fullstack"),
		DBCharset:                getEnv("DB_CHARSET", "utf8mb4"),
		DBParseTime:              getEnv("DB_PARSE_TIME", "true"),
		DBLoc:                    getEnv("DB_LOC", "Local"),
		DBMaxIdleConns:           getEnvAsInt("DB_MAX_IDLE_CONNS", 10),
		DBMaxOpenConns:           getEnvAsInt("DB_MAX_OPEN_CONNS", 100),
		DBConnMaxLifetimeMinutes: getEnvAsInt("DB_CONN_MAX_LIFETIME_MINUTES", 60),
		JWTAccessSecret:          getEnv("JWT_ACCESS_SECRET", "dev-secret-change-me"),
		JWTAccessTTLMinutes:      getEnvAsInt("JWT_ACCESS_TTL_MINUTES", 15),
		JWTRefreshTTLHours:       getEnvAsInt("JWT_REFRESH_TTL_HOURS", 168),
	}
}

func loadDotEnv() {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../backend/.env")
	_ = godotenv.Load("backend/.env")
}

func (c Config) MySQLDSN() string {
	cfg := mysql.Config{
		User:                 c.DBUser,
		Passwd:               c.DBPassword,
		Net:                  "tcp",
		Addr:                 net.JoinHostPort(c.DBHost, c.DBPort),
		DBName:               c.DBName,
		AllowNativePasswords: true,
		Params: map[string]string{
			"charset":   c.DBCharset,
			"parseTime": c.DBParseTime,
			"loc":       c.DBLoc,
		},
	}

	return cfg.FormatDSN()
}

func getEnv(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	return value
}

func getEnvAsInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func getEnvAsSlice(key string, fallback []string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			result = append(result, item)
		}
	}

	if len(result) == 0 {
		return fallback
	}

	return result
}
