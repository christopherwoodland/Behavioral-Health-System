# Environment Configuration

This project uses separate environment files for different deployment scenarios:

## Environment Files

### `.env.local` - Local Development
- **Purpose**: Used when running locally with `npm run dev`
- **API Endpoint**: `http://localhost:7071/api` (local Azure Functions)
- **Authentication**: Disabled by default for easier testing
- **Debug Logging**: Enabled
- **Polling**: Faster intervals for development

### `.env.production` - Production Deployment
- **Purpose**: Used for production builds and deployments
- **API Endpoint**: `https://cwbhieastus001.azurewebsites.net/api` (production Azure Functions)
- **Authentication**: Enabled with production URLs
- **Debug Logging**: Disabled for performance
- **Polling**: Slower intervals for production

### `.env` - Shared/Override
- **Purpose**: Contains settings you've manually configured
- **Priority**: Takes precedence over the specific environment files

## Environment Loading Priority

Vite loads environment files in this order (later files override earlier ones):

1. `.env.production` (if NODE_ENV=production)
2. `.env.local` (if NODE_ENV=development) 
3. `.env` (always loaded last, can override anything)

## Usage

### Local Development
```bash
npm run dev
# Automatically uses .env.local settings
```

### Production Build
```bash
npm run build
# Automatically uses .env.production settings
```

### Manual Override
If you need to temporarily override settings, edit `.env` - it will take precedence over the environment-specific files.

## Key Differences

| Setting | Local | Production |
|---------|-------|------------|
| API Base | localhost:7071 | Azure Functions App |
| Auth Enabled | false | true |
| Debug Logging | true | false |
| Poll Interval | 1000ms | 3000ms |
| Redirect URIs | localhost:5173 | Production domain |

## Security Notes

- Never commit sensitive credentials to git
- The SAS URL in these files will expire on 2026-06-26
- Consider using Azure Key Vault for production secrets