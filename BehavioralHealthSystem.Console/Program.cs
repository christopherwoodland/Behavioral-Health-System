using System.CommandLine;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using BehavioralHealthSystem.Services;
using BehavioralHealthSystem.Helpers.Services;
using BehavioralHealthSystem.Configuration;
using Azure.Storage.Blobs;
using Azure.Identity;

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
        
        var startPageOption = new Option<int>(
            name: "--start-page",
            description: "Starting page number for extraction",
            getDefaultValue: () => 1);
        startPageOption.AddAlias("-s");
        
        var endPageOption = new Option<int>(
            name: "--end-page",
            description: "Ending page number for extraction",
            getDefaultValue: () => 991);
        endPageOption.AddAlias("-e");
        
        var verboseOption = new Option<bool>(
            name: "--verbose",
            description: "Enable verbose logging",
            getDefaultValue: () => false);
        verboseOption.AddAlias("-v");

        dsm5Command.AddOption(pdfPathOption);
        dsm5Command.AddOption(startPageOption);
        dsm5Command.AddOption(endPageOption);
        dsm5Command.AddOption(verboseOption);

        dsm5Command.SetHandler(async (pdfPath, startPage, endPage, verbose) =>
        {
            // Build configuration
            var configuration = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json", optional: true)
                .AddEnvironmentVariables()
                .Build();

            // Build service provider with DSM5DataService
            var services = new ServiceCollection();
            services.AddLogging(builder => builder.AddConsole().SetMinimumLevel(verbose ? LogLevel.Debug : LogLevel.Information));
            services.AddSingleton<IConfiguration>(configuration);
            
            // Register Azure Content Understanding Service (used when DSM5_EXTRACTION_METHOD=CONTENT_UNDERSTANDING)
            services.AddSingleton<IAzureContentUnderstandingService, AzureContentUnderstandingService>();
            
            // Register DSM5DataService
            services.AddSingleton<IDSM5DataService, DSM5DataService>();

            var serviceProvider = services.BuildServiceProvider();
            var dsm5Service = serviceProvider.GetRequiredService<IDSM5DataService>();

            var importer = new DSM5Importer(dsm5Service, verbose);
            await importer.ImportAsync(pdfPath, startPage, endPage);
        }, pdfPathOption, startPageOption, endPageOption, verboseOption);

        rootCommand.AddCommand(dsm5Command);

        return await rootCommand.InvokeAsync(args);
    }
}

/// <summary>
/// Handles DSM-5 data import operations using DSM5DataService directly
/// </summary>
public class DSM5Importer
{
    private readonly IDSM5DataService _dsm5Service;
    private readonly bool _verbose;

    public DSM5Importer(IDSM5DataService dsm5Service, bool verbose)
    {
        _dsm5Service = dsm5Service ?? throw new ArgumentNullException(nameof(dsm5Service));
        _verbose = verbose;
    }

    public async Task ImportAsync(string pdfPath, int startPage, int endPage)
    {
        try
        {
            WriteHeader("DSM-5 Data Import Tool");
            WriteInfo($"PDF File: {pdfPath}");
            WriteInfo($"Page Range: {startPage} to {endPage}");
            WriteInfo($"Mode: Direct Azure Content Understanding (no Function timeout)");
            System.Console.WriteLine();

            // Step 1: Validate prerequisites
            ValidatePrerequisites(pdfPath);

            // Step 2: Check system status
            await CheckSystemStatusAsync();

            // Step 3: Extract PDF data directly using DSM5DataService
            await ExtractAndUploadPdfDataAsync(pdfPath, startPage, endPage);

            // Step 4: Verify availability
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

    private void ValidatePrerequisites(string pdfPath)
    {
        WriteStep("Step 1/4: Validating prerequisites");

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
        WriteStep("Step 2/4: Checking DSM-5 storage status");

        try
        {
            var status = await _dsm5Service.GetDataStatusAsync();

            WriteSuccess("Storage service is accessible");
            WriteInfo($"  Current conditions: {status.TotalConditions}");
            WriteInfo($"  Available conditions: {status.AvailableConditions}");
            
            if (_verbose)
            {
                WriteVerbose($"Container exists: {status.ContainerExists}");
                WriteVerbose($"Data version: {status.DataVersion}");
                WriteVerbose($"Last updated: {status.LastUpdated}");
            }

            System.Console.WriteLine();
        }
        catch (Exception ex)
        {
            WriteWarning($"Could not check system status: {ex.Message}");
            WriteInfo("Continuing with import...");
            System.Console.WriteLine();
        }
    }

    private async Task ExtractAndUploadPdfDataAsync(string pdfPath, int startPage, int endPage)
    {
        WriteStep("Step 3/4: Extracting and uploading DSM-5 data");
        WriteWarning("This may take 15-20 minutes for full PDF (no timeout limits)...");

        // Read and encode PDF
        WriteVerbose("Reading PDF file...");
        byte[] pdfBytes = await File.ReadAllBytesAsync(pdfPath);
        string pdfBase64 = Convert.ToBase64String(pdfBytes);
        
        WriteVerbose($"PDF size: {FormatFileSize(pdfBytes.Length)}");
        WriteVerbose($"Base64 size: {FormatFileSize(pdfBase64.Length)}");

        // Prepare page ranges
        var pageRanges = $"{startPage}-{endPage}";
        WriteInfo($"Processing pages: {pageRanges}");
        WriteInfo("Sending PDF to Azure Content Understanding service...");

        var startTime = DateTime.UtcNow;

        // Call DSM5DataService directly (no Function timeout!)
        var result = await _dsm5Service.ExtractDiagnosticCriteriaAsync(
            pdfUrl: null,
            pdfBase64: pdfBase64,
            pageRanges: pageRanges,
            autoUpload: true);

        var elapsed = DateTime.UtcNow - startTime;

        if (result.Success)
        {
            WriteSuccess($"Extraction and upload successful!");
            WriteInfo($"  Conditions found: {result.ExtractedConditions?.Count ?? 0}");
            WriteInfo($"  Processing time: {result.ProcessingTimeMs / 1000.0:F1}s");
            WriteInfo($"  Total elapsed: {elapsed.TotalSeconds:F1}s");
            WriteInfo($"  Uploaded to storage: {result.UploadedToStorage}");
            
            if (!string.IsNullOrEmpty(result.BlobPath))
            {
                WriteVerbose($"  Blob path: {result.BlobPath}");
            }
            
            System.Console.WriteLine();
        }
        else
        {
            throw new InvalidOperationException($"Extraction failed: {result.ErrorMessage}");
        }
    }

    private async Task VerifyDataAsync()
    {
        WriteStep("Step 4/4: Verifying DSM-5 conditions are available");

        try
        {
            var conditions = await _dsm5Service.GetAvailableConditionsAsync(
                category: null,
                searchTerm: null,
                includeDetails: false);

            WriteSuccess($"Verification successful!");
            WriteInfo($"  Total conditions: {conditions.Count}");
            
            System.Console.WriteLine();

            // Show sample conditions
            if (conditions.Any())
            {
                WriteInfo("Sample conditions:");
                foreach (var condition in conditions.Take(5))
                {
                    WriteInfo($"  • {condition.Name} ({condition.Code})");
                }
                System.Console.WriteLine();
            }
        }
        catch (Exception ex)
        {
            WriteWarning($"Could not verify conditions: {ex.Message}");
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
