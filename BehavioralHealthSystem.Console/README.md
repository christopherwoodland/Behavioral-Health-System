# Behavioral Health System - Console Application

A command-line interface for administrative tasks, testing, and development operations for the behavioral health system.

## 🚀 Overview

This console application provides a comprehensive command-line interface for managing, testing, and administering the behavioral health system. It serves as a development tool for testing APIs, running administrative tasks, and performing system diagnostics.

### Key Features

- ✅ **API Testing** - Command-line interface for testing all system APIs
- ✅ **Data Management** - Administrative tools for data import/export and cleanup
- ✅ **System Diagnostics** - Health checks and system status monitoring
- ✅ **Development Tools** - Utilities for developers and system administrators
- ✅ **Batch Operations** - Automated processing and bulk operations
- ✅ **Configuration Management** - Environment setup and configuration validation

## 📁 Project Structure

```text
BehavioralHealthSystem.Console/
├── 📁 Commands/                     # Command implementations
│   ├── ApiTestCommand.cs           # API testing commands
│   ├── DataCommand.cs              # Data management commands
│   ├── HealthCheckCommand.cs       # System health verification
│   └── ConfigCommand.cs            # Configuration management
├── 📁 Services/                    # Console-specific services
│   ├── ApiTestService.cs           # API testing utilities
│   ├── DataImportService.cs        # Data import/export services
│   └── ReportingService.cs         # Console reporting utilities
├── 📁 Models/                      # Console application models
│   ├── CommandResult.cs            # Command execution results
│   ├── TestResult.cs              # API test results
│   └── SystemStatus.cs            # System status information
├── 📁 Utilities/                   # Helper utilities
│   ├── ConsoleHelper.cs           # Console output formatting
│   ├── ArgumentParser.cs          # Command-line argument parsing
│   └── ConfigurationHelper.cs     # Configuration management
├── 📄 Program.cs                  # Application entry point
├── 📄 appsettings.json           # Application configuration
└── 📄 README.md                  # This documentation
```

## 🛠️ Technology Stack

### Core Technologies

- **🔢 .NET 8** - Latest .NET version with console application template
- **⚙️ Microsoft.Extensions.Configuration** - Configuration management
- **💉 Microsoft.Extensions.DependencyInjection** - Service container
- **📝 Microsoft.Extensions.Logging** - Structured logging support

### Development Tools

- **📋 Command Pattern** - Structured command-line interface implementation
- **🔧 Argument Parsing** - Robust command-line argument handling
- **📊 Progress Reporting** - Visual progress indicators for long operations
- **🎨 Formatted Output** - Colored and structured console output

## 🖥️ Command-Line Interface

### Available Commands

#### API Testing Commands

```bash
# Test all API endpoints
dotnet run -- test api --all

# Test specific endpoint
dotnet run -- test api --endpoint "risk-assessment"

# Test with specific data
dotnet run -- test api --endpoint "phq9" --data "test-data.json"

# Run load testing
dotnet run -- test load --endpoint "predictions" --concurrent 10 --duration 60s
```

#### Data Management Commands

```bash
# Import test data
dotnet run -- data import --file "sample-data.json" --type "assessments"

# Export assessment results
dotnet run -- data export --type "assessments" --date-range "2024-01-01:2024-12-31"

# Clean up expired sessions
dotnet run -- data cleanup --expired-sessions --older-than "7d"

# Generate sample data
dotnet run -- data generate --type "phq9" --count 100
```

#### Health Check Commands

```bash
# Check all system components
dotnet run -- health check --all

# Check specific service
dotnet run -- health check --service "azure-openai"

# Continuous monitoring
dotnet run -- health monitor --interval 30s --duration 10m

# Generate health report
dotnet run -- health report --output "health-report.json"
```

#### Configuration Commands

```bash
# Validate configuration
dotnet run -- config validate

# Show current configuration
dotnet run -- config show --sensitive false

# Update configuration value
dotnet run -- config set --key "AzureOpenAI:ApiKey" --value "new-key"

# Test configuration connectivity
dotnet run -- config test --service "all"
```

### Command Implementation

#### ApiTestCommand

```csharp
public class ApiTestCommand : ICommand
{
    private readonly IApiTestService _apiTestService;
    private readonly ILogger<ApiTestCommand> _logger;

    public async Task<CommandResult> ExecuteAsync(string[] args)
    {
        var options = ParseArguments(args);
        
        switch (options.Operation)
        {
            case "all":
                return await TestAllEndpoints();
            case "endpoint":
                return await TestSpecificEndpoint(options.Endpoint);
            case "load":
                return await RunLoadTest(options);
            default:
                return CommandResult.Error("Unknown API test operation");
        }
    }

    private async Task<CommandResult> TestAllEndpoints()
    {
        var endpoints = new[]
        {
            "/api/health",
            "/api/risk-assessment/initiate",
            "/api/risk-assessment/predict",
            "/api/phq9/start",
            "/api/session/create"
        };

        var results = new List<TestResult>();
        
        foreach (var endpoint in endpoints)
        {
            Console.Write($"Testing {endpoint}... ");
            
            var result = await _apiTestService.TestEndpointAsync(endpoint);
            results.Add(result);
            
            Console.WriteLine(result.Success ? "✓ PASS" : "✗ FAIL");
            
            if (!result.Success)
            {
                Console.WriteLine($"  Error: {result.ErrorMessage}");
            }
        }

        return CommandResult.Success($"Tested {results.Count} endpoints. {results.Count(r => r.Success)} passed.");
    }
}
```

#### DataCommand

```csharp
public class DataCommand : ICommand
{
    private readonly IDataImportService _dataImportService;
    private readonly ILogger<DataCommand> _logger;

    public async Task<CommandResult> ExecuteAsync(string[] args)
    {
        var options = ParseArguments(args);
        
        return options.Operation switch
        {
            "import" => await ImportData(options),
            "export" => await ExportData(options),
            "cleanup" => await CleanupData(options),
            "generate" => await GenerateData(options),
            _ => CommandResult.Error("Unknown data operation")
        };
    }

    private async Task<CommandResult> ImportData(DataCommandOptions options)
    {
        if (!File.Exists(options.FilePath))
        {
            return CommandResult.Error($"File not found: {options.FilePath}");
        }

        Console.WriteLine($"Importing data from {options.FilePath}...");
        
        var progress = new Progress<ImportProgress>(p =>
        {
            Console.Write($"\rProgress: {p.ProcessedCount}/{p.TotalCount} ({p.PercentComplete:F1}%)");
        });

        var result = await _dataImportService.ImportAsync(options.FilePath, options.DataType, progress);
        
        Console.WriteLine();
        return result.Success 
            ? CommandResult.Success($"Successfully imported {result.ImportedCount} records")
            : CommandResult.Error($"Import failed: {result.ErrorMessage}");
    }
}
```

#### HealthCheckCommand

```csharp
public class HealthCheckCommand : ICommand
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<HealthCheckCommand> _logger;

    public async Task<CommandResult> ExecuteAsync(string[] args)
    {
        var options = ParseArguments(args);
        
        return options.Operation switch
        {
            "check" => await PerformHealthCheck(options),
            "monitor" => await MonitorHealth(options),
            "report" => await GenerateHealthReport(options),
            _ => CommandResult.Error("Unknown health operation")
        };
    }

    private async Task<CommandResult> PerformHealthCheck(HealthCheckOptions options)
    {
        var healthChecks = options.CheckAll 
            ? GetAllHealthChecks() 
            : GetSpecificHealthCheck(options.ServiceName);

        Console.WriteLine("Performing health checks...\n");

        foreach (var healthCheck in healthChecks)
        {
            Console.Write($"Checking {healthCheck.Name}... ");
            
            var result = await healthCheck.CheckHealthAsync();
            
            var status = result.Status switch
            {
                HealthStatus.Healthy => "✓ HEALTHY",
                HealthStatus.Degraded => "⚠ DEGRADED",
                HealthStatus.Unhealthy => "✗ UNHEALTHY",
                _ => "? UNKNOWN"
            };

            Console.WriteLine(status);
            
            if (result.Status != HealthStatus.Healthy)
            {
                Console.WriteLine($"  {result.Description}");
                if (result.Exception != null)
                {
                    Console.WriteLine($"  Exception: {result.Exception.Message}");
                }
            }
        }

        return CommandResult.Success("Health check completed");
    }
}
```

## 🔧 Configuration

### 🔒 Security Setup (IMPORTANT)

This project requires sensitive configuration that **MUST NOT** be committed to Git. Follow these steps to set up your local environment:

1. **Copy the template file:**
   ```powershell
   # Copy the template to create your local configuration
   Copy-Item "appsettings.template.json" "appsettings.json"
   ```

2. **Update the configuration with your real values:**
   ```json
   {
     "DSM5_STORAGE_ACCOUNT_NAME": "your-actual-storage-account",
     "DSM5_CONTAINER_NAME": "dsm5-data",
     "AzureWebJobsStorage": "DefaultEndpointsProtocol=https;AccountName=your-account;AccountKey=YOUR_ACTUAL_KEY;EndpointSuffix=core.windows.net",
     "AZURE_CONTENT_UNDERSTANDING_ENDPOINT": "https://your-resource.services.ai.azure.com/",
     "AZURE_CONTENT_UNDERSTANDING_KEY": "YOUR_ACTUAL_API_KEY",
     "DSM5_EXTRACTION_METHOD": "CONTENT_UNDERSTANDING"
   }
   ```

3. **Never commit appsettings.json:**
   - The file `appsettings.json` is in `.gitignore` and should never be committed
   - Only commit changes to `appsettings.template.json` if you add new configuration keys
   - Use environment variables or Azure Key Vault for production deployments

### Application Settings

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "BehavioralHealthSystem": "Debug"
    }
  },
  "ApiEndpoints": {
    "BaseUrl": "https://localhost:7071",
    "Timeout": "00:00:30"
  },
  "TestData": {
    "DefaultDataPath": "./TestData",
    "GeneratedDataPath": "./GeneratedData"
  },
  "HealthChecks": {
    "Interval": "00:00:30",
    "Timeout": "00:00:10"
  },
  "Output": {
    "VerboseMode": false,
    "UseColors": true,
    "LogToFile": false
  }
}
```

### Environment Configuration

```bash
# Development environment
export DOTNET_ENVIRONMENT=Development
export BEHAVIORALHEALTH_API_URL=https://localhost:7071
export BEHAVIORALHEALTH_LOG_LEVEL=Debug

# Production environment
export DOTNET_ENVIRONMENT=Production
export BEHAVIORALHEALTH_API_URL=https://api.behavioralhealth.com
export BEHAVIORALHEALTH_LOG_LEVEL=Information
```

## 🧪 Usage Examples

### Running API Tests

```bash
# Test all endpoints with verbose output
dotnet run -- test api --all --verbose

# Test specific endpoint with custom data
dotnet run -- test api --endpoint "risk-assessment/predict" --data "{\"responses\":[1,2,3]}"

# Run load test for 5 minutes with 20 concurrent users
dotnet run -- test load --endpoint "predictions" --concurrent 20 --duration 5m --ramp-up 30s
```

### Data Operations

```bash
# Import PHQ-9 assessment data
dotnet run -- data import --file "phq9-samples.json" --type "phq9" --validate

# Export all assessments from last month
dotnet run -- data export --type "assessments" --date-range "2024-11-01:2024-11-30" --format json

# Generate 500 sample PHQ-9 assessments
dotnet run -- data generate --type "phq9" --count 500 --output "generated-assessments.json"

# Clean up sessions older than 30 days
dotnet run -- data cleanup --expired-sessions --older-than "30d" --dry-run
```

### System Monitoring

```bash
# Continuous health monitoring for 1 hour
dotnet run -- health monitor --duration 1h --interval 30s --alert-threshold degraded

# Generate comprehensive health report
dotnet run -- health report --include-history --output "health-report-$(date +%Y%m%d).json"

# Check Azure OpenAI connectivity
dotnet run -- health check --service "azure-openai" --timeout 30s
```

## 📊 Output Formatting

### Console Output Examples

```text
=== Behavioral Health System Console ===

Testing API Endpoints:
  ✓ /api/health (200ms)
  ✓ /api/risk-assessment/initiate (450ms)
  ✗ /api/risk-assessment/predict (timeout)
    Error: Request timeout after 30 seconds
  ✓ /api/phq9/start (320ms)

Summary: 3/4 endpoints passed (75%)

Health Check Results:
  ✓ Database Connection - HEALTHY
  ⚠ Azure OpenAI Service - DEGRADED
    Warning: High response latency (2.3s average)
  ✓ Blob Storage - HEALTHY
  ✗ SignalR Hub - UNHEALTHY
    Error: Connection refused

Overall Status: DEGRADED
```

### Progress Indicators

```text
Importing assessment data...
Progress: ████████████████████████████████ 100% (1,250/1,250)
✓ Successfully imported 1,250 PHQ-9 assessments

Generating sample data...
Progress: ██████████████████████░░░░░░░░░░  65% (325/500)
ETA: 2m 15s remaining
```

## 🧪 Testing Utilities

### API Test Service

```csharp
public class ApiTestService : IApiTestService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<ApiTestService> _logger;

    public async Task<TestResult> TestEndpointAsync(string endpoint, object data = null)
    {
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            HttpResponseMessage response;
            
            if (data != null)
            {
                var json = JsonSerializer.Serialize(data);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                response = await _httpClient.PostAsync(endpoint, content);
            }
            else
            {
                response = await _httpClient.GetAsync(endpoint);
            }

            stopwatch.Stop();

            return new TestResult
            {
                Endpoint = endpoint,
                Success = response.IsSuccessStatusCode,
                StatusCode = (int)response.StatusCode,
                ResponseTime = stopwatch.Elapsed,
                ResponseBody = await response.Content.ReadAsStringAsync()
            };
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            
            return new TestResult
            {
                Endpoint = endpoint,
                Success = false,
                ResponseTime = stopwatch.Elapsed,
                ErrorMessage = ex.Message
            };
        }
    }

    public async Task<LoadTestResult> RunLoadTestAsync(LoadTestOptions options)
    {
        var results = new ConcurrentBag<TestResult>();
        var cancellationToken = new CancellationTokenSource(options.Duration);
        
        var tasks = Enumerable.Range(0, options.ConcurrentUsers)
            .Select(async i =>
            {
                // Stagger start times for ramp-up
                await Task.Delay(i * options.RampUpDelay, cancellationToken.Token);
                
                while (!cancellationToken.Token.IsCancellationRequested)
                {
                    var result = await TestEndpointAsync(options.Endpoint, options.TestData);
                    results.Add(result);
                    
                    await Task.Delay(options.RequestInterval, cancellationToken.Token);
                }
            })
            .ToArray();

        await Task.WhenAll(tasks);

        return AnalyzeLoadTestResults(results.ToList());
    }
}
```

### Data Generation Service

```csharp
public class DataGenerationService : IDataGenerationService
{
    public async Task<IEnumerable<Phq9Assessment>> GeneratePhq9AssessmentsAsync(int count)
    {
        var assessments = new List<Phq9Assessment>();
        var random = new Random();

        for (int i = 0; i < count; i++)
        {
            var assessment = new Phq9Assessment
            {
                Id = Guid.NewGuid().ToString(),
                UserId = $"user_{i:D6}",
                StartedAt = DateTime.UtcNow.AddDays(-random.Next(0, 365)),
                Responses = GenerateRandomResponses(random),
                CompletedAt = DateTime.UtcNow.AddDays(-random.Next(0, 365))
            };

            assessment.TotalScore = assessment.Responses.Sum();
            assessment.SeverityLevel = CalculateSeverityLevel(assessment.TotalScore);

            assessments.Add(assessment);
        }

        return assessments;
    }

    private List<int> GenerateRandomResponses(Random random)
    {
        // Generate realistic PHQ-9 responses with weighted distribution
        var responses = new List<int>();
        
        for (int i = 0; i < 9; i++)
        {
            // Weighted towards lower scores (more realistic distribution)
            var weights = new[] { 0.4, 0.3, 0.2, 0.1 }; // 0, 1, 2, 3
            var response = SelectWeightedRandom(weights, random);
            responses.Add(response);
        }

        return responses;
    }
}
```

## 🔒 Security Considerations

### Authentication

```csharp
public class AuthenticatedApiTestService : ApiTestService
{
    protected override async Task<HttpRequestMessage> PrepareRequestAsync(HttpRequestMessage request)
    {
        // Add authentication headers
        var token = await GetAuthTokenAsync();
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        
        return request;
    }

    private async Task<string> GetAuthTokenAsync()
    {
        // Implement token acquisition logic
        return await _tokenService.GetTokenAsync();
    }
}
```

### Data Sanitization

```csharp
public class SecureDataImportService : DataImportService
{
    protected override async Task<T> ValidateDataAsync<T>(T data)
    {
        // Validate and sanitize imported data
        await _dataValidator.ValidateAsync(data);
        return _dataSanitizer.Sanitize(data);
    }
}
```

## 🚀 Deployment

### Building the Console Application

```bash
# Build for current platform
dotnet build -c Release

# Build for specific platform
dotnet publish -c Release -r win-x64 --self-contained false

# Create single-file executable
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

### Docker Container

```dockerfile
FROM mcr.microsoft.com/dotnet/runtime:8.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["BehavioralHealthSystem.Console/BehavioralHealthSystem.Console.csproj", "BehavioralHealthSystem.Console/"]
RUN dotnet restore "BehavioralHealthSystem.Console/BehavioralHealthSystem.Console.csproj"
COPY . .
WORKDIR "/src/BehavioralHealthSystem.Console"
RUN dotnet build "BehavioralHealthSystem.Console.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "BehavioralHealthSystem.Console.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "BehavioralHealthSystem.Console.dll"]
```

## 🤝 Contributing

### Adding New Commands

1. **Create Command Class** - Implement `ICommand` interface
2. **Add Argument Parsing** - Define command-line argument structure
3. **Implement Business Logic** - Add the command's core functionality
4. **Register Command** - Add to the command registry in `Program.cs`
5. **Add Tests** - Create unit tests for the command
6. **Update Documentation** - Document the new command usage

### Development Guidelines

- **Input Validation** - Always validate command-line arguments
- **Error Handling** - Provide clear error messages and exit codes
- **Progress Reporting** - Show progress for long-running operations
- **Logging** - Use structured logging for debugging and monitoring
- **Testing** - Include both unit and integration tests

## 📚 Dependencies

- **Microsoft.Extensions.Configuration** - Configuration management
- **Microsoft.Extensions.DependencyInjection** - Service container
- **Microsoft.Extensions.Logging** - Logging infrastructure
- **Microsoft.Extensions.Http** - HTTP client factory
- **System.CommandLine** - Command-line argument parsing

## 🩺 DSM-5 Import Command (`import-dsm5`)

### Overview

The `import-dsm5` command processes **split DSM-5 diagnostic PDF files** (one diagnostic per file) and uploads them to Azure Blob Storage. Each PDF file in the input directory contains a single diagnostic element and is processed individually using Azure Content Understanding.

### Installation

```powershell
# Build from source
cd BehavioralHealthSystem.Console
dotnet build -c Release

# Executable location
bin\Release\net8.0\bhs.exe
```

### Prerequisites

1. **Split DSM-5 PDF Files** - Individual PDF files for each diagnostic condition
   - Files should be named: `dsm5_{DIAGNOSTIC_CODE}_{DISORDER_TITLE}.pdf`
   - Each PDF contains a single diagnostic element
   - Default location: `dsm\single-pages\` (relative to console app directory)

2. **Azure Configuration** - Configure in `appsettings.json`:
   ```json
   {
     "AZURE_CONTENT_UNDERSTANDING_ENDPOINT": "https://your-content-understanding.services.ai.azure.com/",
     "AZURE_CONTENT_UNDERSTANDING_KEY": "your-api-key-here",
     "DSM5_STORAGE_ACCOUNT_NAME": "your-storage-account-name",
     "DSM5_CONTAINER_NAME": "dsm5-data",
     "DSM5_EXTRACTION_METHOD": "CONTENT_UNDERSTANDING"
   }
   ```
   
   **Note:** `DSM5_EXTRACTION_METHOD` must be set to `"CONTENT_UNDERSTANDING"` to use the Azure Content Understanding service instead of Document Intelligence.

3. **Authentication** - Either:
   - API Key in configuration (development)
   - Azure Managed Identity (production)
   - Azure CLI logged in (`az login`)

### Usage

**Command:**
```powershell
bhs import-dsm5 [options]
```

**Important:** This command **bypasses the Azure Functions** and calls Azure Content Understanding directly, avoiding the 5-minute Function timeout limit. Each diagnostic PDF is processed individually, and the total time depends on the number of files.

**Options:**

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--directory <path>` | `-d` | Path to directory containing split DSM-5 PDFs | `dsm\single-pages` |
| `--pattern <pattern>` | `-p` | File pattern to match (glob pattern) | `dsm5_*.pdf` |
| `--max-files <count>` | `-m` | Maximum number of files to process (for testing) | None (all files) |
| `--verbose` | `-v` | Enable verbose logging | `false` |

**Examples:**

```powershell
# Basic usage - processes all PDFs in default directory
bhs import-dsm5

# Process PDFs from custom directory
bhs import-dsm5 --directory "C:\DSM5\split-files"

# Process with verbose logging
bhs import-dsm5 -v

# Process only first 10 files (for testing)
bhs import-dsm5 --max-files 10 -v

# Process specific pattern
bhs import-dsm5 --pattern "dsm5_300_*.pdf"

# Custom directory with file limit
bhs import-dsm5 -d "C:\DSM5\diagnostics" -m 5 -v
```

### Process Flow

**Direct Azure Service Integration** - No Functions timeout limits!

1. **Validate Directory and Discover Files**
   - Checks directory exists and is accessible
   - Discovers all PDF files matching the pattern
   - Displays total files found and total size
   - Shows sample file names for verification

2. **Check Storage Status**
   - Verifies Azure Blob Storage connectivity
   - Shows current DSM-5 data status

3. **Process Split PDF Files** (Batch Processing)
   - Loops through each PDF file individually
   - For each file:
     - Reads PDF file and encodes to base64
     - **Directly calls** Azure Content Understanding service (no 5-minute timeout!)
     - Extracts diagnostic condition using AI (each file contains one diagnostic)
     - **Automatically uploads** to Azure Blob Storage
     - Reports success/failure and processing time
   - Shows progress indicator: `[3/59] Processing: dsm5_300_01_F41_0_Panic_Disorder.pdf`
   - Displays batch processing summary with success/failure counts

4. **Verify Availability**
   - Confirms all conditions are accessible in storage
   - Displays sample conditions extracted

### Expected Output

```
==================================================
  DSM-5 Data Import Tool - Batch Processing
==================================================

Directory: C:\Users\cwoodland\dev\BehavioralHealthSystem\BehavioralHealthSystem.Console\dsm\single-pages
File Pattern: dsm5_*.pdf
Mode: Direct Azure Content Understanding (no Function timeout)

Step 1/4: Validating directory and discovering PDF files
✓ Directory found: C:\...\dsm\single-pages
✓ Found 59 PDF files
  Processing all 59 files
  Total size: 8.42 MB
  [VERBOSE] Sample files:
  [VERBOSE]   • dsm5_292_89_F16_983_Hallucinogen_Persisting_Perception_Disorder.pdf
  [VERBOSE]   • dsm5_293_89_F06_1_Another_Medical_Condition.pdf
  [VERBOSE]   • dsm5_295_40_F20_81_Schizophreniform_Disorder.pdf
  [VERBOSE]   • dsm5_296_89_F31_81_Bipolar_II_Disorder.pdf
  [VERBOSE]   • dsm5_296_99_F34_8_Disruptive_Mood_Dysregulation_Disorder.pdf
  [VERBOSE]   ... and 54 more

Step 2/4: Checking DSM-5 storage status
✓ Storage service is accessible
  Current conditions: 0
  Available conditions: 0

Step 3/4: Processing split DSM-5 PDF files
Processing 59 diagnostic PDF files...
⚠ Each file contains a single diagnostic and will be processed individually.

[1/59] Processing: dsm5_292_89_F16_983_Hallucinogen_Persisting_Perception_Disorder.pdf
  [VERBOSE] Size: 142.37 KB
✓ Extracted in 8.2s - Found 1 condition(s)

[2/59] Processing: dsm5_293_89_F06_1_Another_Medical_Condition.pdf
  [VERBOSE] Size: 156.91 KB
✓ Extracted in 7.8s - Found 1 condition(s)

[3/59] Processing: dsm5_295_40_F20_81_Schizophreniform_Disorder.pdf
  [VERBOSE] Size: 134.22 KB
✓ Extracted in 8.5s - Found 1 condition(s)

... [progress continues for all 59 files] ...

Batch Processing Summary
✓ Successfully processed: 57/59
✗ Failed: 2/59
Total processing time: 9.2 minutes
Average per file: 9.4s

Failed files:
  • dsm5_300_12_F44_0_somatic_symptom_disorder_eating_disorders_substanc.pdf: Timeout
  • dsm5_312_32_F63_2_478_Disruptive_Impulse-Control_and_Conduct_Disorde.pdf: Parse error

Step 4/4: Verifying DSM-5 conditions are available
✓ Verification successful!
  Total conditions: 57

Sample conditions:
  • Panic Disorder (300.01 / F41.0)
  • Generalized Anxiety Disorder (300.02 / F41.1)
  • Agoraphobia (300.22 / F40.00)
  • Social Anxiety Disorder (300.23 / F40.10)
  • Obsessive-Compulsive Disorder (300.3 / F42)

✓ DSM-5 data import completed successfully!

Next Steps:
  1. Refresh your React app (Ctrl+F5)
  2. Navigate to a session's Extended Risk Assessment
  3. Select DSM-5 conditions from the dropdown
  4. Run the extended assessment
```

### Troubleshooting

#### "Directory not found"
**Solution:** Verify directory path is correct. Use `--directory` option to specify custom path, or ensure `dsm\single-pages` exists relative to console app.

#### "No PDF files found matching pattern"
**Solution:** 
- Check files are named with pattern `dsm5_*.pdf`
- Verify files are in the correct directory
- Use `--pattern` option to specify custom pattern

#### "Extraction failed" for specific files
**Solution:** 
- Check if PDF file is corrupted or empty
- Verify Azure Content Understanding service configuration in `appsettings.json`
- Some files may have complex formatting that causes parsing issues

#### "Upload failed"
**Solution:** Verify `AzureWebJobsStorage` connection string and Azure authentication in `appsettings.json`

#### Partial Success (Some files failed)
**Solution:** 
- Review the "Failed files" section in the output
- Re-run import with `--pattern` targeting only failed files
- Check individual file integrity

### Development

Run in debug mode with verbose output:

```powershell
cd BehavioralHealthSystem.Console
dotnet run -- import-dsm5 --verbose
```

---

### Progress Tracking & Resume Capability

**NEW:** The `import-dsm5` command now includes automatic progress tracking that allows imports to be resumed if they fail or are interrupted.

#### Features

- ✅ **Automatic Progress Saving** - Each completed file is recorded to `dsm5-import-progress.json`
- ✅ **Smart Resume** - Automatically skips already-processed files when re-run
- ✅ **Failure Tracking** - Records failed files with error messages for investigation
- ✅ **Multi-Session Support** - Progress accumulates across multiple runs
- ✅ **Auto-Cleanup** - Progress file is automatically deleted when all files complete successfully

#### Additional Commands

**Check Import Status:**
```powershell
bhs import-status
```

Shows:
- Total files, completed, failed, remaining
- Completion percentage
- List of failed files with errors
- Start time and last update time

**Reset Progress (Start Fresh):**
```powershell
bhs import-reset
```

Deletes the progress file so next import starts from beginning.

#### Usage Examples

**Resume Failed Import:**
```powershell
# First run - processes 30/59 files then fails
bhs import-dsm5

# Check what happened
bhs import-status
# Shows: Completed: 30 (50.8%), Failed: 5, Remaining: 24

# Fix issues (network, API keys, etc.) then resume
bhs import-dsm5
# Automatically skips 30 completed files
# Processes remaining 24 + retries 5 failed = 29 files
```

**Test with Small Batch:**
```powershell
# Test first 5 files
bhs import-dsm5 --max-files 5

# If successful, reset and run full import
bhs import-reset
bhs import-dsm5
```

For detailed documentation on progress tracking, see [IMPORT_PROGRESS_TRACKING.md](./IMPORT_PROGRESS_TRACKING.md).

### Development

Run in debug mode with verbose output:

```powershell
cd BehavioralHealthSystem.Console
dotnet run -- import-dsm5 --verbose
```

---

This console application provides comprehensive administrative and testing capabilities for the behavioral health system, enabling efficient development and operations management.
````