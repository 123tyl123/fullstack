package migration

import (
	"fmt"

	"backend/internal/model"

	"gorm.io/gorm"
)

func Up(db *gorm.DB) error {
	if err := db.SetupJoinTable(&model.Article{}, "Tags", &model.ArticleTag{}); err != nil {
		return fmt.Errorf("setup article tags join table: %w", err)
	}

	if err := db.AutoMigrate(
		&model.User{},
		&model.AuthSession{},
		&model.Category{},
		&model.Tag{},
		&model.Article{},
		&model.ArticleTag{},
		&model.Comment{},
		&model.MediaAsset{},
	); err != nil {
		return fmt.Errorf("auto migrate: %w", err)
	}

	return nil
}
