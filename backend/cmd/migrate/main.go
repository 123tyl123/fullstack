package main

import (
	"fmt"
	"log"
	"os"
	"strings"

	"backend/internal/config"
	"backend/internal/database"
	"backend/internal/migration"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := strings.ToLower(os.Args[1])
	switch command {
	case "up":
		runUp()
	default:
		printUsage()
		os.Exit(1)
	}
}

func runUp() {
	cfg := config.Load()

	db, err := database.NewMySQL(cfg)
	if err != nil {
		log.Fatalf("database init failed: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("database handle failed: %v", err)
	}
	defer sqlDB.Close()

	if err := migration.Up(db); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	log.Println("migration completed")
}

func printUsage() {
	fmt.Println("Usage:")
	fmt.Println("  go run ./cmd/migrate up")
}
