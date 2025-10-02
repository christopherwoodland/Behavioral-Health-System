using System.CommandLine;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace BehavioralHealthSystem.Console;

/// <summary>
/// Command-line tool for administrative tasks including DSM-5 data import
/// </summary>
public class Program
{
    public static async Task<int> Main(string[] args)
    {
        var rootCommand = new RootCommand("Behavioral Health System - Administrative CLI Tool");

        // DSM-5 import command
        var dsm5Command = new Command("import-dsm5", "Import DSM-5 diagnostic conditions from PDF");
        
        var pdfPathOption = new Option<string>(
            name: "--pdf-path",
            description: "Path to the DSM-5 PDF file",
            getDefaultValue: () => @"C:\DSM5\dsm5.pdf");
        pdfPathOption.AddAlias("-p");
        
        var apiUrlOption = new Option<string>(
            name: "--api-url",
            description: "Base URL of the Functions API",
            getDefaultValue: () => "http://localhost:7071/api");
        apiUrlOption.AddAlias("-u");
        
        var startPageOption = new Option<int>(
            name: "--start-page",
            description: "Starting page number for extraction",
            getDefaultValue: () => 1);
        
        var endPageOption = new Option<int>(
            name: "--end-page",
            description: "Ending page number for extraction",
            getDefaultValue: () => 991);
        
        var verboseOption = new Option<bool>(
            name: "--verbose",
            description: "Enable verbose logging",
            getDefaultValue: () => false);
        verboseOption.AddAlias("-v");

        dsm5Command.AddOption(pdfPathOption);
        dsm5Command.AddOption(apiUrlOption);
        dsm5Command.AddOption(startPageOption);
        dsm5Command.AddOption(endPageOption);
        dsm5Command.AddOption(verboseOption);

        dsm5Command.SetHandler(async (pdfPath, apiUrl, startPage, endPage, verbose) =>
        {
            var importer = new DSM5Importer(apiUrl, verbose);
            await importer.ImportAsync(pdfPath, startPage, endPage);
        }, pdfPathOption, apiUrlOption, startPageOption, endPageOption, verboseOption);

        rootCommand.AddCommand(dsm5Command);

        return await rootCommand.InvokeAsync(args);
    }
}

/// <summary>
/// Handles DSM-5 data import operations
/// </summary>
public class DSM5Importer
{
    private readonly HttpClient _httpClient;
    private readonly string _apiBaseUrl;
    private readonly bool _verbose;

    public DSM5Importer(string apiBaseUrl, bool verbose)
    {
        _apiBaseUrl = apiBaseUrl.TrimEnd('/');
        _verbose = verbose;
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromMinutes(10) // Long timeout for large PDF processing
        };
    }

    public async Task ImportAsync(string pdfPath, int startPage, int endPage)
    {
        try
        {
            WriteHeader("DSM-5 Data Import Tool");
            WriteInfo($"PDF File: {pdfPath}");
            WriteInfo($"API URL: {_apiBaseUrl}");
            WriteInfo($"Page Range: {startPage} to {endPage}");
            System.Console.WriteLine();

            // Step 1: Validate prerequisites
            await ValidatePrerequisitesAsync(pdfPath);

            // Step 2: Check system status
            await CheckSystemStatusAsync();

            // Step 3: Extract PDF data
            var extractedData = await ExtractPdfDataAsync(pdfPath, startPage, endPage);

            // Step 4: Upload to storage
            await UploadDataAsync(extractedData);

            // Step 5: Verify availability
            await VerifyDataAsync();

            WriteSuccess("DSM-5 data import completed successfully!");
            System.Console.WriteLine();
            WriteInfo("Next Steps:");
            WriteInfo("  1. Refresh your React app (Ctrl+F5)");
            WriteInfo("  2. Navigate to a session's Extended Risk Assessment");
            WriteInfo("  3. Select DSM-5 conditions from the dropdown");
            WriteInfo("  4. Run the extended assessment");
            System.Console.WriteLine();
        }
        catch (Exception ex)
        {
            WriteError($"Import failed: {ex.Message}");
            if (_verbose)
            {
                WriteError($"Stack trace: {ex.StackTrace}");
            }
            Environment.Exit(1);
        }
    }

    private async Task ValidatePrerequisitesAsync(string pdfPath)
    {
        WriteStep("Step 1/5: Validating prerequisites");

        // Check PDF file exists
        if (!File.Exists(pdfPath))
        {
            throw new FileNotFoundException($"PDF file not found at: {pdfPath}");
        }

        var fileInfo = new FileInfo(pdfPath);
        WriteSuccess($"PDF file found ({FormatFileSize(fileInfo.Length)})");

        // Check file is not empty
        if (fileInfo.Length == 0)
        {
            throw new InvalidOperationException("PDF file is empty");
        }

        // Check file is readable
        try
        {
            using var fs = File.OpenRead(pdfPath);
            WriteVerbose("PDF file is readable");
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Cannot read PDF file: {ex.Message}");
        }

        System.Console.WriteLine();
    }

    private async Task CheckSystemStatusAsync()
    {
        WriteStep("Step 2/5: Checking DSM-5 system status");

        try
        {
            var url = $"{_apiBaseUrl}/dsm5-admin/data-status";
            WriteVerbose($"GET {url}");

            var response = await _httpClient.GetAsync(url);
            
            if (!response.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"API returned {response.StatusCode}");
            }

            var content = await response.Content.ReadAsStringAsync();
            var status = JsonSerializer.Deserialize<JsonElement>(content);

            WriteSuccess("API is accessible");
            
            if (_verbose)
            {
                WriteVerbose("System Status:");
                WriteVerbose(JsonSerializer.Serialize(status, new JsonSerializerOptions 
                { 
                    WriteIndented = true 
                }));
            }

            System.Console.WriteLine();
        }
        catch (HttpRequestException ex)
        {
            throw new InvalidOperationException(
                "Cannot connect to API. Is the Functions host running?\n" +
                $"  Run: cd BehavioralHealthSystem.Functions && func start --port 7071\n" +
                $"  Error: {ex.Message}");
        }
    }

    private async Task<JsonElement> ExtractPdfDataAsync(string pdfPath, int startPage, int endPage)
    {
        WriteStep("Step 3/5: Extracting DSM-5 data from PDF");
        WriteWarning("This may take several minutes depending on PDF size...");

        // Read and encode PDF
        WriteVerbose("Reading PDF file...");
        byte[] pdfBytes = await File.ReadAllBytesAsync(pdfPath);
        string pdfBase64 = Convert.ToBase64String(pdfBytes);
        
        WriteVerbose($"PDF size: {FormatFileSize(pdfBytes.Length)}");
        WriteVerbose($"Base64 size: {FormatFileSize(pdfBase64.Length)}");

        // Prepare extraction request with base64 data
        var pageRanges = $"{startPage}-{endPage}";
        var request = new
        {
            pdfBase64 = pdfBase64,
            pageRanges = pageRanges,
            autoUpload = true  // Automatically upload to storage after extraction
        };

        var jsonContent = JsonSerializer.Serialize(request);
        WriteVerbose($"Request size: {FormatFileSize(Encoding.UTF8.GetByteCount(jsonContent))}");

        // Send extraction request
        var url = $"{_apiBaseUrl}/dsm5-admin/validate-extraction";
        WriteInfo("Sending PDF to Document Intelligence service...");
        WriteVerbose($"POST {url}");

        var startTime = DateTime.UtcNow;
        var httpContent = new StringContent(jsonContent, Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, httpContent);

        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Extraction failed: {response.StatusCode}\n{errorContent}");
        }

        var responseContent = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<JsonElement>(responseContent);

        var elapsed = DateTime.UtcNow - startTime;

        if (result.TryGetProperty("success", out var success) && success.GetBoolean())
        {
            // Get extraction result
            var extractionResult = result.GetProperty("extractionResult");
            var conditionsFound = extractionResult.GetProperty("conditionsFound").GetInt32();
            var processingTime = extractionResult.GetProperty("processingTimeSeconds").GetDouble();
            var uploadedToStorage = extractionResult.TryGetProperty("uploadedToStorage", out var uploaded) && uploaded.GetBoolean();

            WriteSuccess($"Extraction successful!");
            WriteInfo($"  Conditions found: {conditionsFound}");
            WriteInfo($"  Processing time: {processingTime:F1}s");
            WriteInfo($"  Total elapsed: {elapsed.TotalSeconds:F1}s");
            
            if (uploadedToStorage)
            {
                WriteInfo($"  Auto-uploaded to storage: Yes");
            }
            
            System.Console.WriteLine();

            return extractionResult;
        }
        else
        {
            var message = result.TryGetProperty("message", out var msg) 
                ? msg.GetString() 
                : "Unknown error";
            throw new InvalidOperationException($"Extraction failed: {message}");
        }
    }

    private async Task UploadDataAsync(JsonElement extractionResult)
    {
        WriteStep("Step 4/5: Uploading extracted data to Azure Storage");

        // Check if data was already auto-uploaded during extraction
        if (extractionResult.TryGetProperty("uploadedToStorage", out var uploaded) && uploaded.GetBoolean())
        {
            WriteInfo("Data was auto-uploaded during extraction");
            
            var conditionsFound = extractionResult.GetProperty("conditionsFound").GetInt32();
            WriteSuccess($"Upload confirmed!");
            WriteInfo($"  Conditions uploaded: {conditionsFound}");
            
            if (extractionResult.TryGetProperty("blobPath", out var blobPath))
            {
                WriteVerbose($"  Blob path: {blobPath.GetString()}");
            }
            
            System.Console.WriteLine();
            return;
        }

        // Manual upload if auto-upload didn't happen
        WriteWarning("Auto-upload was not completed, uploading manually...");

        var request = new
        {
            extractedData = extractionResult,
            overwriteExisting = true
        };

        var jsonContent = JsonSerializer.Serialize(request, new JsonSerializerOptions 
        { 
            WriteIndented = false 
        });
        
        WriteVerbose($"Upload payload size: {FormatFileSize(Encoding.UTF8.GetByteCount(jsonContent))}");

        var url = $"{_apiBaseUrl}/dsm5-admin/upload-data";
        WriteInfo("Uploading to blob storage...");
        WriteVerbose($"POST {url}");

        var httpContent = new StringContent(jsonContent, Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, httpContent);

        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Upload failed: {response.StatusCode}\n{errorContent}");
        }

        var responseContent = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<JsonElement>(responseContent);

        if (result.TryGetProperty("success", out var success) && success.GetBoolean())
        {
            var conditionsUploaded = result.GetProperty("conditionsUploaded").GetInt32();
            var blobUrl = result.TryGetProperty("blobUrl", out var url_prop) 
                ? url_prop.GetString() 
                : "N/A";

            WriteSuccess($"Upload successful!");
            WriteInfo($"  Conditions uploaded: {conditionsUploaded}");
            WriteVerbose($"  Blob URL: {blobUrl}");
            System.Console.WriteLine();
        }
        else
        {
            var message = result.TryGetProperty("message", out var msg) 
                ? msg.GetString() 
                : "Unknown error";
            throw new InvalidOperationException($"Upload failed: {message}");
        }
    }

    private async Task VerifyDataAsync()
    {
        WriteStep("Step 5/5: Verifying DSM-5 conditions are available");

        var url = $"{_apiBaseUrl}/dsm5-admin/conditions";
        WriteVerbose($"GET {url}");

        var response = await _httpClient.GetAsync(url);

        if (!response.IsSuccessStatusCode)
        {
            WriteWarning("Could not verify conditions");
            return;
        }

        var content = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        if (result.TryGetProperty("success", out var success) && success.GetBoolean())
        {
            // Try to get total conditions from different possible locations in response
            var totalConditions = result.TryGetProperty("totalConditions", out var total) 
                ? total.GetInt32() 
                : (result.TryGetProperty("conditions", out var conditionsArray) ? conditionsArray.GetArrayLength() : 0);

            WriteSuccess($"Verification successful!");
            WriteInfo($"  Total conditions: {totalConditions}");
            
            // Categories might not be in the response if using default query
            if (result.TryGetProperty("categories", out var categories))
            {
                var categoryCount = categories.GetArrayLength();
                WriteInfo($"  Categories: {categoryCount}");
            }
            
            System.Console.WriteLine();

            // Show sample conditions
            if (result.TryGetProperty("conditions", out var conditions))
            {
                WriteInfo("Sample conditions:");
                var count = 0;
                foreach (var condition in conditions.EnumerateArray())
                {
                    if (count >= 5) break;
                    
                    if (condition.TryGetProperty("name", out var nameProp) && 
                        condition.TryGetProperty("code", out var codeProp))
                    {
                        var name = nameProp.GetString();
                        var code = codeProp.GetString();
                        WriteInfo($"  • {name} ({code})");
                        count++;
                    }
                }
                System.Console.WriteLine();
            }
        }
        else
        {
            WriteWarning("Could not verify conditions");
        }
    }

    // Formatting helpers
    private static string FormatFileSize(long bytes)
    {
        string[] sizes = { "B", "KB", "MB", "GB" };
        double len = bytes;
        int order = 0;
        while (len >= 1024 && order < sizes.Length - 1)
        {
            order++;
            len = len / 1024;
        }
        return $"{len:F2} {sizes[order]}";
    }

    // Console output helpers
    private void WriteHeader(string message)
    {
        System.Console.ForegroundColor = ConsoleColor.Cyan;
        System.Console.WriteLine("==================================================");
        System.Console.WriteLine($"  {message}");
        System.Console.WriteLine("==================================================");
        System.Console.ResetColor();
        System.Console.WriteLine();
    }

    private void WriteStep(string message)
    {
        System.Console.ForegroundColor = ConsoleColor.Cyan;
        System.Console.WriteLine(message);
        System.Console.ResetColor();
    }

    private void WriteSuccess(string message)
    {
        System.Console.ForegroundColor = ConsoleColor.Green;
        System.Console.WriteLine($"✓ {message}");
        System.Console.ResetColor();
    }

    private void WriteInfo(string message)
    {
        System.Console.WriteLine(message);
    }

    private void WriteWarning(string message)
    {
        System.Console.ForegroundColor = ConsoleColor.Yellow;
        System.Console.WriteLine($"⚠ {message}");
        System.Console.ResetColor();
    }

    private void WriteError(string message)
    {
        System.Console.ForegroundColor = ConsoleColor.Red;
        System.Console.WriteLine($"✗ {message}");
        System.Console.ResetColor();
    }

    private void WriteVerbose(string message)
    {
        if (_verbose)
        {
            System.Console.ForegroundColor = ConsoleColor.Gray;
            System.Console.WriteLine($"  [VERBOSE] {message}");
            System.Console.ResetColor();
        }
    }
}
