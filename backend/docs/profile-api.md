# 个人资料接口文档

## 1. 通用说明

这些接口都需要登录后访问。

请求头：

```http
Authorization: Bearer <access_token>
```

统一成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

## 2. 获取当前用户

```text
GET /api/users/me
```

### 成功响应

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 1,
    "username": "admin",
    "nickname": "Admin",
    "email": "admin@example.com",
    "avatar_url": "/api/uploads/avatars/2026/07/avatar.jpg",
    "bio": "后端开发者",
    "role": 2,
    "status": 1,
    "last_login_at": "2026-07-18T10:00:00Z"
  }
}
```

## 3. 修改个人资料

```text
PUT /api/users/me
```

### 请求参数

所有字段都是可选字段，传什么改什么。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| username | string | 否 | 用户名，长度 3-64，不能包含空白字符 |
| nickname | string | 否 | 昵称，长度 1-64 |
| email | string | 否 | 邮箱，会转为小写保存 |
| bio | string | 否 | 个人简介，最多 500 字符；传空字符串可清空 |

### 请求示例

```json
{
  "username": "new_admin",
  "nickname": "New Admin",
  "email": "new_admin@example.com",
  "bio": "专注 Go、Gin、Gorm 的博客作者"
}
```

### 成功响应

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 1,
    "username": "new_admin",
    "nickname": "New Admin",
    "email": "new_admin@example.com",
    "avatar_url": "/api/uploads/avatars/2026/07/avatar.jpg",
    "bio": "专注 Go、Gin、Gorm 的博客作者",
    "role": 2,
    "status": 1,
    "last_login_at": "2026-07-18T10:00:00Z"
  }
}
```

### 失败响应

| HTTP 状态码 | message | 说明 |
| --- | --- | --- |
| 400 | invalid request body | 请求体不是合法 JSON |
| 400 | invalid input: ... | 参数校验失败 |
| 401 | missing authorization token | 未传 token |
| 401 | invalid authorization token | token 无效或过期 |
| 403 | user disabled | 用户已禁用 |
| 404 | user not found | 用户不存在 |
| 409 | username or email already exists | 用户名或邮箱已被占用 |
| 500 | internal server error | 服务内部错误 |

## 4. 上传头像

```text
POST /api/users/me/avatar
```

请求类型：

```http
Content-Type: multipart/form-data
```

### 表单参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| avatar | file | 是 | 头像文件 |

支持的文件类型：

- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`

默认最大大小：

```text
5MB
```

可以通过 `.env` 修改：

```text
AVATAR_MAX_SIZE_MB=5
UPLOAD_DIR=uploads
UPLOAD_PUBLIC_PATH=/api/uploads
```

### cURL 示例

```bash
curl -X POST http://localhost:8080/api/users/me/avatar \
  -H "Authorization: Bearer <access_token>" \
  -F "avatar=@./avatar.png"
```

### 成功响应

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "avatar_url": "/api/uploads/avatars/2026/07/8ddadf3c8c6a47d4b7f46d8d8dbb72c1.png",
    "user": {
      "id": 1,
      "username": "new_admin",
      "nickname": "New Admin",
      "email": "new_admin@example.com",
      "avatar_url": "/api/uploads/avatars/2026/07/8ddadf3c8c6a47d4b7f46d8d8dbb72c1.png",
      "bio": "专注 Go、Gin、Gorm 的博客作者",
      "role": 2,
      "status": 1,
      "last_login_at": "2026-07-18T10:00:00Z"
    }
  }
}
```

### 失败响应

| HTTP 状态码 | message | 说明 |
| --- | --- | --- |
| 400 | avatar file is required | 没有上传 `avatar` 文件 |
| 400 | unsupported avatar file type | 文件类型不支持 |
| 401 | missing authorization token | 未传 token |
| 401 | invalid authorization token | token 无效或过期 |
| 403 | user disabled | 用户已禁用 |
| 404 | user not found | 用户不存在 |
| 413 | avatar file too large | 文件超过大小限制 |
| 500 | internal server error | 服务内部错误 |

## 5. 头像访问

头像上传成功后，返回的 `avatar_url` 可以直接用于前端图片地址：

```html
<img src="/api/uploads/avatars/2026/07/avatar.png" />
```

当前实现是本地存储。后续如果切换 OSS/S3，只需要调整上传服务生成的 `url` 和 `path`，用户表仍然只保存 `avatar_url`。
