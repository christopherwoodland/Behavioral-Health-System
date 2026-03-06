using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Azure.Storage.Blobs;
using BehavioralHealthSystem.Agents.DependencyInjection;
using BehavioralHealthSystem.Configuration;
using BehavioralHealthSystem.Functions.Services;
using BehavioralHealthSystem.Helpers.Data;
using BehavioralHealthSystem.Helpers.Models;
using BehavioralHealthSystem.Helpers.Services;
using BehavioralHealthSystem.Helpers.Services.PostgreSQL;
using BehavioralHealthSystem.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

// Helper to get secrets from Key Vault
SecretClient? GetKeyVaultClient(IConfiguration config)
{
    // Try KEY_VAULT_URI first (from Bicep), then KEY_VAULT_URL for backwards compatibility
    var keyVaultUrl = config["KEY_VAULT_URI"] ?? config["KEY_VAULT_URL"];
    if (string.IsNullOrWhiteSpace(keyVaultUrl))
    {
        return null;
    }
    try
    {
        return new SecretClient(new Uri(keyVaultUrl), new DefaultAzureCredential());
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Warning: Could not create Key Vault client: {ex.Message}");
        return null;
    }
}

string? GetSecretFromKeyVault(SecretClient? client, string secretName, string? fallbackValue = null)
{
    if (client == null) return fallbackValue;
    try
    {
        var secret = client.GetSecret(secretName);
        return secret.Value?.Value ?? fallbackValue;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Warning: Could not retrieve {secretName} from Key Vault: {ex.Message}");
        return fallbackValue;
    }
}

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults(worker =>
    {
        // Add CORS middleware
        worker.UseMiddleware<BehavioralHealthSystem.Functions.Services.CorsMiddleware>();
    })
    .ConfigureServices((context, services) =>
    {
        var config = context.Configuration;
        var keyVaultClient = GetKeyVaultClient(config);

        // Configuration
        services.Configure<LocalDamModelOptions>(options =>
        {
            options.BaseUrl = config["LOCAL_DAM_BASE_URL"] ?? "http://localhost:8000";
            options.InitiatePath = config["LOCAL_DAM_INITIATE_PATH"] ?? "initiate";
            options.PredictionPath = config["LOCAL_DAM_PREDICTION_PATH"] ?? "predict";
            options.ApiKey = config["LOCAL_DAM_API_KEY"];
            options.ModelId = config["LOCAL_DAM_MODEL_ID"] ?? "KintsugiHealth/dam";
            options.TimeoutSeconds = config.GetValue<int>("LOCAL_DAM_TIMEOUT_SECONDS", 300);
        });

        // Azure OpenAI Configuration
        services.Configure<AzureOpenAIOptions>(options =>
        {
            var config = context.Configuration;
            options.Endpoint = config["AZURE_OPENAI_ENDPOINT"] ?? string.Empty;
            options.ApiKey = config["AZURE_OPENAI_API_KEY"] ?? string.Empty;
            options.DeploymentName = config["AZURE_OPENAI_DEPLOYMENT"] ?? "gpt-4o";
            options.ApiVersion = config["AZURE_OPENAI_API_VERSION"] ?? "2024-02-01";
            options.MaxTokens = config.GetValue<int>("AZURE_OPENAI_MAX_TOKENS", 1500);
            options.Temperature = config.GetValue<double>("AZURE_OPENAI_TEMPERATURE", 0.3);
            options.Enabled = config.GetValue<bool>("AZURE_OPENAI_ENABLED", false);
        });

        // Extended Assessment (GPT-5/O3) Configuration
        services.Configure<ExtendedAssessmentOpenAIOptions>(options =>
        {
            var config = context.Configuration;
            options.Endpoint = config["EXTENDED_ASSESSMENT_OPENAI_ENDPOINT"] ?? string.Empty;
            options.ApiKey = config["EXTENDED_ASSESSMENT_OPENAI_API_KEY"] ?? string.Empty;
            options.DeploymentName = config["EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT"] ?? string.Empty;
            options.ApiVersion = config["EXTENDED_ASSESSMENT_OPENAI_API_VERSION"] ?? "2024-08-01-preview";
            options.MaxTokens = config.GetValue<int>("EXTENDED_ASSESSMENT_OPENAI_MAX_TOKENS", 4000);
            options.Temperature = config.GetValue<double>("EXTENDED_ASSESSMENT_OPENAI_TEMPERATURE", 0.2);
            options.TimeoutSeconds = config.GetValue<int>("EXTENDED_ASSESSMENT_OPENAI_TIMEOUT_SECONDS", 120);
            options.Enabled = config.GetValue<bool>("EXTENDED_ASSESSMENT_OPENAI_ENABLED", false);
            options.UseFallbackToStandardConfig = config.GetValue<bool>("EXTENDED_ASSESSMENT_USE_FALLBACK", true);
        });

        // HTTP Client with policies for local DAM model
        services.AddHttpClient<ILocalDamModelService, LocalDamModelService>()
            .ConfigureHttpClient((serviceProvider, client) =>
            {
                var options = serviceProvider.GetService<IOptions<LocalDamModelOptions>>()?.Value;
                if (options != null)
                {
                    client.BaseAddress = new Uri(options.BaseUrl.TrimEnd('/') + "/");
                    client.Timeout = TimeSpan.FromSeconds(Math.Max(30, options.TimeoutSeconds));
                    if (!string.IsNullOrWhiteSpace(options.ApiKey))
                    {
                        client.DefaultRequestHeaders.Remove("X-API-Key");
                        client.DefaultRequestHeaders.Add("X-API-Key", options.ApiKey);
                    }
                }
            })
            .AddPolicyHandler((serviceProvider, request) =>
                RetryPolicies.GetRetryPolicy(serviceProvider.GetService<ILogger<LocalDamModelService>>()));

        services.AddHostedService<LocalDamWarmupHostedService>();

        // Authentication & Authorization Services
        services.AddSingleton<IEntraIdValidationService, EntraIdValidationService>();
        services.AddSingleton<IApiKeyValidationService, ApiKeyValidationService>();

        // Application Services
        services.AddScoped<IRiskAssessmentService, RiskAssessmentService>();
        services.AddScoped<IAzureContentUnderstandingService, AzureContentUnderstandingService>();
        services.AddMemoryCache();
        services.AddScoped<IGrammarCorrectionService, GrammarCorrectionService>();
        services.AddScoped<GenericErrorHandlingService>();
        services.AddScoped<ExceptionHandlingService>();
        services.AddScoped<BehavioralHealthSystem.Functions.Services.FunctionErrorHandlingService>();
        services.AddScoped<FeatureFlagsService>();
        LoggingConfiguration.ConfigureStructuredLogging(services, context.HostingEnvironment.IsDevelopment());
        services.AddSingleton<BlobServiceClient>(serviceProvider =>
        {
            var config = serviceProvider.GetService<IConfiguration>();
            if (config == null)
            {
                throw new InvalidOperationException("Configuration not available");
            }

            // First check for explicit connection string (Docker)
            var connectionString = config["AZURE_STORAGE_CONNECTION_STRING"] ?? config.GetConnectionString("AzureStorage");
            if (!string.IsNullOrEmpty(connectionString))
            {
                return new BlobServiceClient(connectionString);
            }

            // Check for storage account name (preferred for managed identity in Azure)
            var storageAccountName = config["DSM5_STORAGE_ACCOUNT_NAME"] ?? config["AZURE_STORAGE_ACCOUNT_NAME"];
            if (!string.IsNullOrEmpty(storageAccountName))
            {
                var blobServiceUri = $"https://{storageAccountName}.blob.core.windows.net";
                // Configure credentials for identity-based storage access
                // In Azure Container Apps, ManagedIdentityCredential is the primary auth mechanism.
                // In local Docker, the connection string path above is used instead, so this branch
                // is only reached when deploying to Azure where MI must be enabled.
                var credentialOptions = new DefaultAzureCredentialOptions
                {
                    ExcludeManagedIdentityCredential = false,
                    ExcludeSharedTokenCacheCredential = true,
                    ExcludeVisualStudioCredential = true,
                    ExcludeVisualStudioCodeCredential = true,
                    ExcludeAzurePowerShellCredential = true,
                    ExcludeAzureDeveloperCliCredential = true
                };

                // Set tenant ID if configured (required when storage account is in a specific tenant)
                var tenantId = config["AZURE_TENANT_ID"];
                if (!string.IsNullOrEmpty(tenantId))
                {
                    credentialOptions.TenantId = tenantId;
                }

                return new BlobServiceClient(new Uri(blobServiceUri), new DefaultAzureCredential(credentialOptions));
            }

            throw new InvalidOperationException(
                "Azure Blob Storage is required. Configure AZURE_STORAGE_CONNECTION_STRING or DSM5_STORAGE_ACCOUNT_NAME/AZURE_STORAGE_ACCOUNT_NAME.");
        });
        services.AddScoped<ISessionStorageService, SessionStorageService>();
        services.AddScoped<IFileGroupStorageService, FileGroupStorageService>();
        services.AddScoped<IBiometricDataService, BiometricDataService>();
        services.AddScoped<IDSM5DataService, DSM5DataService>();
        services.AddScoped<IExtendedAssessmentJobService, ExtendedAssessmentJobService>();

        // ==================== Storage Backend Toggle ====================
        var storageBackend = config["STORAGE_BACKEND"] ?? "BlobStorage";
        if (storageBackend.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase))
        {
            // Support multiple PostgreSQL connection formats:
            // 1. POSTGRES_CONNECTION_STRING (Npgsql format: Host=...;Port=...;Database=...)
            // 2. POSTGRES_URL (URI format from Container Apps service binding: postgresql://user:pass@host:port/db)
            // 3. Individual vars from Container Apps service binding (POSTGRES_HOST, POSTGRES_PORT, etc.)
            var pgConnectionString = config["POSTGRES_CONNECTION_STRING"];

            if (string.IsNullOrEmpty(pgConnectionString))
            {
                // Try URI format (Container Apps add-on injects POSTGRES_URL)
                var postgresUrl = config["POSTGRES_URL"];
                if (!string.IsNullOrEmpty(postgresUrl))
                {
                    // Npgsql supports URI format directly
                    pgConnectionString = postgresUrl;
                }
            }

            if (string.IsNullOrEmpty(pgConnectionString))
            {
                // Try individual env vars (Container Apps service binding)
                var host = config["POSTGRES_HOST"];
                var port = config["POSTGRES_PORT"] ?? "5432";
                var user = config["POSTGRES_USERNAME"] ?? config["POSTGRES_USER"];
                var pass = config["POSTGRES_PASSWORD"];
                var db = config["POSTGRES_DATABASE"] ?? "postgres";
                var useManagedIdentity = config["POSTGRES_USE_MANAGED_IDENTITY"];

                // Azure Managed Identity: acquire Entra token as the PG password
                if (!string.IsNullOrEmpty(host)
                    && host.Contains(".postgres.database.azure.com", StringComparison.OrdinalIgnoreCase)
                    && string.Equals(useManagedIdentity, "true", StringComparison.OrdinalIgnoreCase))
                {
                    var credential = new DefaultAzureCredential();
                    var tokenResult = credential.GetToken(
                        new Azure.Core.TokenRequestContext(new[] { "https://ossrdbms-aad.database.windows.net/.default" }));

                    var builder = new Npgsql.NpgsqlConnectionStringBuilder
                    {
                        Host = host,
                        Port = int.TryParse(port, out var pMi) ? pMi : 5432,
                        Database = db,
                        Username = user,           // PG role name mapped to the MI
                        Password = tokenResult.Token,
                        SslMode = Npgsql.SslMode.Require
                    };

                    pgConnectionString = builder.ConnectionString;
                    Console.WriteLine("PostgreSQL: Using Managed Identity (Entra ID token) authentication.");
                }
                else if (!string.IsNullOrEmpty(host) && !string.IsNullOrEmpty(user))
                {
                    // Password-based authentication (local Docker, legacy)
                    var builder = new Npgsql.NpgsqlConnectionStringBuilder
                    {
                        Host = host,
                        Port = int.TryParse(port, out var p) ? p : 5432,
                        Database = db,
                        Username = user,
                        Password = pass
                    };

                    // Azure Database for PostgreSQL requires SSL
                    if (host.Contains(".postgres.database.azure.com", StringComparison.OrdinalIgnoreCase))
                    {
                        builder.SslMode = Npgsql.SslMode.Require;
                    }

                    pgConnectionString = builder.ConnectionString;
                }
            }

            if (string.IsNullOrEmpty(pgConnectionString))
            {
                throw new InvalidOperationException(
                    "PostgreSQL connection is required when STORAGE_BACKEND=PostgreSQL. " +
                    "Set POSTGRES_CONNECTION_STRING, POSTGRES_URL, or individual vars (POSTGRES_HOST, POSTGRES_USERNAME, POSTGRES_PASSWORD).");
            }

            services.AddDbContext<BhsDbContext>(options =>
                options.UseNpgsql(pgConnectionString));

            // Override blob-based registrations with PostgreSQL implementations
            services.AddScoped<ISessionStorageService, PgSessionStorageService>();
            services.AddScoped<IFileGroupStorageService, PgFileGroupStorageService>();
            services.AddScoped<IBiometricDataService, PgBiometricDataService>();
            services.AddScoped<IDSM5DataService, PgDSM5DataService>();
            services.AddScoped<IExtendedAssessmentJobService, PgExtendedAssessmentJobService>();

            // New PG-only services (structured data that was previously inline in functions)
            services.AddScoped<IChatTranscriptService, PgChatTranscriptService>();
            services.AddScoped<IPhqAssessmentService, PgPhqAssessmentService>();
            services.AddScoped<IPhqProgressService, PgPhqProgressService>();
            services.AddScoped<IPhqSessionService, PgPhqSessionService>();
            services.AddScoped<ISmartBandDataService, PgSmartBandDataService>();
            services.AddScoped<IAudioMetadataService, PgAudioMetadataService>();
        }
        services.AddValidatorsFromAssemblyContaining<UserMetadataValidator>();
        services.AddHealthChecks();
        services.AddSignalR();

        // Semantic Kernel audio processing pipeline (Fetch → Convert → Predict)
        services.AddAgentServices();
    })
    .Build();

// Initialize PostgreSQL database schema if configured (with retry for container orchestration)
var storageBackendInit = host.Services.GetService<IConfiguration>()?["STORAGE_BACKEND"];
if (storageBackendInit?.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase) == true)
{
    using var scope = host.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<BhsDbContext>();

    // Retry database connection — PostgreSQL container may not be ready immediately
    const int maxRetries = 10;
    const int delaySeconds = 5;
    for (int attempt = 1; attempt <= maxRetries; attempt++)
    {
        try
        {
            var created = await db.Database.EnsureCreatedAsync();
            if (created)
            {
                Console.WriteLine("PostgreSQL database created with full schema.");
            }
            else
            {
                // Database already exists — EnsureCreatedAsync does NOT update schema.
                // Run raw SQL to create any missing tables so new entity types are available.
                Console.WriteLine("PostgreSQL database already exists. Checking for missing tables...");
                var pendingScript = db.Database.GenerateCreateScript();
                // Execute individual CREATE TABLE IF NOT EXISTS blocks
                try
                {
                    // Use the generated script but wrap in a safety block
                    await db.Database.ExecuteSqlRawAsync(
                        "DO $$ BEGIN " +
                        "IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'file_groups') THEN " +
                        "CREATE TABLE file_groups (\"GroupId\" text NOT NULL, \"GroupName\" text NOT NULL, \"Description\" text, \"CreatedAt\" text NOT NULL, \"UpdatedAt\" text NOT NULL, \"CreatedBy\" text NOT NULL, \"SessionCount\" integer NOT NULL DEFAULT 0, \"Status\" text NOT NULL, CONSTRAINT \"PK_file_groups\" PRIMARY KEY (\"GroupId\")); " +
                        "RAISE NOTICE 'Created file_groups table'; " +
                        "END IF; " +
                        "END $$;");
                    Console.WriteLine("Missing table check complete.");
                }
                catch (Exception schemaEx)
                {
                    Console.WriteLine($"Schema update warning (non-fatal): {schemaEx.Message}");
                }
            }
            break;
        }
        catch (Exception ex) when (attempt < maxRetries)
        {
            Console.WriteLine($"PostgreSQL connection attempt {attempt}/{maxRetries} failed: {ex.Message}");
            Console.WriteLine($"Retrying in {delaySeconds} seconds...");
            await Task.Delay(TimeSpan.FromSeconds(delaySeconds));
        }
    }

    // Seed DSM-5 conditions if table is empty
    var dsm5Count = await db.Dsm5Conditions.CountAsync();
    if (dsm5Count == 0)
    {
        Console.WriteLine("DSM-5 conditions table is empty. Attempting to seed from JSON files...");

        // Check multiple possible data directories
        var possiblePaths = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "Data", "dsm5-data", "conditions"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "data", "dsm5-data", "conditions"),
            "/data/dsm5-data/conditions"  // Docker volume mount
        };

        var dataDir = possiblePaths.FirstOrDefault(Directory.Exists);

        if (dataDir != null)
        {
            var jsonFiles = Directory.GetFiles(dataDir, "*.json");
            Console.WriteLine($"Found {jsonFiles.Length} DSM-5 condition files in {dataDir}");

            var seeded = 0;
            var jsonOptions = new System.Text.Json.JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            foreach (var file in jsonFiles)
            {
                try
                {
                    var json = await File.ReadAllTextAsync(file);
                    var condition = System.Text.Json.JsonSerializer.Deserialize<DSM5ConditionData>(json, jsonOptions);
                    if (condition != null)
                    {
                        condition.LastUpdated = DateTime.UtcNow;
                        db.Dsm5Conditions.Add(condition);
                        seeded++;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"  Warning: Failed to load {Path.GetFileName(file)}: {ex.Message}");
                }
            }

            if (seeded > 0)
            {
                await db.SaveChangesAsync();
                Console.WriteLine($"Successfully seeded {seeded} DSM-5 conditions into PostgreSQL.");
            }
        }
        else
        {
            Console.WriteLine("DSM-5 data directory not found. Run scripts/seed-dsm5-data.ps1 to seed manually.");
        }
    }
    else
    {
        Console.WriteLine($"DSM-5 conditions table already has {dsm5Count} records. Skipping seed.");
    }
}

await host.RunAsync();
