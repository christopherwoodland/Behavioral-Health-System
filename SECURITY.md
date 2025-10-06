# 🔒 Security Guidelines - Behavioral Health System

## 🚨 CRITICAL: Never Commit Secrets to Git

This document outlines security practices for the Behavioral Health System to prevent accidental exposure of sensitive information.

## 📋 Files That MUST NOT Be Committed

### ❌ Sensitive Configuration Files

- `appsettings.json` (any project) - Contains API keys and connection strings
- `local.settings.json` (Azure Functions) - Contains local development secrets
- `.env` files - Environment variables with secrets
- `*.secrets.json` - User secrets files
- Azure publish profiles (`*.pubxml`) - Contains deployment credentials

### ✅ Safe Template Files (These CAN be committed)

- `appsettings.template.json` - Template with placeholder values
- `local.settings.json.template` - Template for Azure Functions
- `local.settings.json.example` - Example configuration
- Documentation that references these templates

## 🛠️ Setting Up Local Development

### 1. Console Application Setup

```powershell
# Navigate to Console project
cd BehavioralHealthSystem.Console

# Copy template to create your local config
Copy-Item "appsettings.template.json" "appsettings.json"

# Edit appsettings.json with your real values (NEVER COMMIT THIS FILE)
# - Replace YOUR_STORAGE_ACCOUNT_KEY with actual Azure Storage key
# - Replace YOUR_AZURE_CONTENT_UNDERSTANDING_API_KEY with actual API key
# - Replace placeholder account names with real values
```

### 2. Azure Functions Setup

```powershell
# Navigate to Functions project
cd BehavioralHealthSystem.Functions

# Copy template to create your local settings
Copy-Item "local.settings.json.template" "local.settings.json"

# Edit local.settings.json with your real values (NEVER COMMIT THIS FILE)
# - Add your actual Azure connection strings
# - Add your API keys
# - Configure local development settings
```

### 3. Web Application Setup

```powershell
# Navigate to Web project
cd BehavioralHealthSystem.Web

# Create .env.local for development (if needed)
echo "VITE_API_BASE_URL=http://localhost:7071/api" > .env.local
```

## 🔍 How to Verify No Secrets Are Committed

### Before Committing Changes

```powershell
# Check what files are being tracked by Git
git ls-files | Select-String "appsettings|local.settings|\.env"

# Should only show template/example files, NOT actual config files

# Check for sensitive content in staged files
git diff --cached | Select-String -Pattern "apikey|accountkey|connectionstring|password|secret|token" -CaseSensitive:$false

# Should return no results or only template placeholders
```

### Audit Current Repository

```powershell
# Search for potentially sensitive content in Git history
git log --all --full-history --source --grep="password\|secret\|key\|token" --oneline

# Search for sensitive patterns in committed files
git grep -E "(apikey|accountkey|connectionstring|password.*=|secret.*=)" HEAD

# List all configuration files in repository
git ls-files | Select-String -Pattern "\.(json|config|env)$"
```

## 🚑 Emergency: Secrets Were Accidentally Committed

### If Secrets Are Committed But Not Pushed

```powershell
# Remove file from staging area
git restore --staged appsettings.json

# Or if it's already committed, remove from history
git reset --soft HEAD~1  # Undo last commit
git reset appsettings.json  # Unstage the file
git commit -m "Remove sensitive files from tracking"
```

### If Secrets Were Pushed to Remote Repository

1. **Immediately rotate all exposed credentials:**
   - Azure Storage Account keys
   - API keys (OpenAI, Content Understanding, Kintsugi)
   - Connection strings
   - Any other secrets that were exposed

2. **Remove sensitive files from Git history:**
   ```powershell
   # Remove file completely from Git history (DANGER: rewrites history)
   git filter-branch --force --index-filter "git rm --cached --ignore-unmatch BehavioralHealthSystem.Console/appsettings.json" --prune-empty --tag-name-filter cat -- --all
   
   # Force push the cleaned history (coordinate with team first!)
   git push origin --force --all
   git push origin --force --tags
   ```

3. **Update .gitignore and commit the security fix:**
   ```powershell
   git add .gitignore
   git commit -m "🔒 Add security protections for sensitive files"
   git push origin
   ```

## 🔧 Production Deployment Security

### Azure Functions

Use Application Settings in Azure Portal instead of local configuration:

1. **Azure Portal** → Function App → Configuration → Application Settings
2. Add all environment variables from `local.settings.json.template`
3. Use Azure Key Vault references for sensitive values:
   ```json
   {
     "AZURE_OPENAI_API_KEY": "@Microsoft.KeyVault(SecretUri=https://myvault.vault.azure.net/secrets/openai-key/)"
   }
   ```

### Azure App Service (Web App)

1. **Azure Portal** → App Service → Configuration → Application Settings
2. Add environment variables with `VITE_` prefix for build-time configuration
3. Use deployment slots for staging/production separation

### CI/CD Pipeline Security

```yaml
# GitHub Actions example - use repository secrets
env:
  AZURE_FUNCTIONAPP_PUBLISH_PROFILE: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
  KINTSUGI_API_KEY: ${{ secrets.KINTSUGI_API_KEY }}
```

## 📚 Security Best Practices

### 1. Principle of Least Privilege

- Create separate Azure resources for development, staging, and production
- Use different API keys for different environments
- Limit access scope of service principals and API keys

### 2. Regular Key Rotation

- Rotate Azure Storage Account keys monthly
- Rotate API keys quarterly
- Update connection strings when keys are rotated
- Document the rotation schedule

### 3. Monitoring and Alerts

- Set up Azure Monitor alerts for unusual API usage
- Monitor for failed authentication attempts
- Track API key usage patterns
- Set up billing alerts for cost anomalies

### 4. Development Environment Isolation

- Never use production keys in development
- Use separate Azure subscriptions/resource groups for dev/prod
- Regularly clean up development resources
- Use Azure Policy to enforce security standards

## 🆘 Security Incident Response

### If You Suspect a Security Breach

1. **Immediately rotate all credentials**
2. **Check Azure Monitor logs for unusual activity**
3. **Review billing for unexpected charges**
4. **Document the incident and lessons learned**
5. **Update security practices based on findings**

### Contact Information

- **Azure Support**: Submit ticket through Azure Portal
- **OpenAI Security**: security@openai.com
- **Kintsugi Health**: Check their security documentation

## ✅ Security Checklist

Before any deployment or commit:

- [ ] No `appsettings.json` files committed
- [ ] No `local.settings.json` files committed  
- [ ] No `.env` files committed
- [ ] All sensitive values use placeholders in templates
- [ ] Production uses Azure Key Vault or App Settings
- [ ] API keys have appropriate scope limitations
- [ ] Monitoring and alerts are configured
- [ ] Team is trained on security practices

## 📖 Additional Resources

- [Azure Key Vault Documentation](https://docs.microsoft.com/en-us/azure/key-vault/)
- [Azure App Configuration](https://docs.microsoft.com/en-us/azure/azure-app-configuration/)
- [GitHub Security Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [.NET Secret Manager](https://docs.microsoft.com/en-us/aspnet/core/security/app-secrets)

---

**Remember: Security is everyone's responsibility. When in doubt, ask the team!**