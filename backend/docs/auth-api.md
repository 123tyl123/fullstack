# 登录注册接口文档

## 1. 通用说明

基础前缀：

```text
/api
```

请求头：

```http
Content-Type: application/json
```

统一响应格式：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

错误响应格式：

```json
{
  "code": 400,
  "message": "invalid input: username length must be between 3 and 64"
}
```

认证成功后会返回：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| token_type | string | 固定为 `Bearer` |
| access_token | string | JWT 访问令牌 |
| expires_in | number | access token 有效秒数 |
| refresh_token | string | 刷新令牌 |
| refresh_expires_at | string | refresh token 过期时间 |
| user | object | 当前用户信息 |

## 2. 注册

```text
POST /api/auth/register
```

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| username | string | 是 | 用户名，长度 3-64，不能包含空白字符 |
| nickname | string | 否 | 昵称，长度 1-64；不传时默认等于 username |
| email | string | 是 | 邮箱，会转为小写后保存 |
| password | string | 是 | 密码，长度 8-72 bytes |

### 请求示例

```json
{
  "username": "admin",
  "nickname": "Admin",
  "email": "admin@example.com",
  "password": "password123"
}
```

### 成功响应

HTTP 状态码：

```text
200 OK
```

响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "token_type": "Bearer",
    "access_token": "<jwt-access-token>",
    "expires_in": 900,
    "refresh_token": "<refresh-token>",
    "refresh_expires_at": "2026-07-25T10:00:00Z",
    "user": {
      "id": 1,
      "username": "admin",
      "nickname": "Admin",
      "email": "admin@example.com",
      "avatar_url": "",
      "bio": "",
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
| 400 | invalid request body | 请求体不是合法 JSON |
| 400 | invalid input: ... | 参数校验失败 |
| 409 | user already exists | username 或 email 已存在 |
| 500 | internal server error | 服务内部错误 |

## 3. 登录

```text
POST /api/auth/login
```

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| account | string | 是 | 用户名或邮箱 |
| password | string | 是 | 密码，长度 8-72 bytes |

### 请求示例

```json
{
  "account": "admin",
  "password": "password123"
}
```

也可以使用邮箱登录：

```json
{
  "account": "admin@example.com",
  "password": "password123"
}
```

### 成功响应

HTTP 状态码：

```text
200 OK
```

响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "token_type": "Bearer",
    "access_token": "<jwt-access-token>",
    "expires_in": 900,
    "refresh_token": "<refresh-token>",
    "refresh_expires_at": "2026-07-25T10:00:00Z",
    "user": {
      "id": 1,
      "username": "admin",
      "nickname": "Admin",
      "email": "admin@example.com",
      "avatar_url": "",
      "bio": "",
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
| 400 | invalid request body | 请求体不是合法 JSON |
| 400 | invalid input: ... | 参数校验失败 |
| 401 | invalid credentials | 账号或密码错误 |
| 403 | user disabled | 用户已禁用 |
| 500 | internal server error | 服务内部错误 |

## 4. 使用 token

后续需要鉴权的接口，建议使用如下请求头：

```http
Authorization: Bearer <access_token>
```

当前文档只覆盖注册和登录接口。刷新 token、退出登录、鉴权中间件可以作为下一组接口继续补。
