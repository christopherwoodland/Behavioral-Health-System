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
        var dsm5Command = new Command("import-dsm5", "Import DSM-5 diagnostic conditions from split PDF files");
        
        var directoryPathOption = new Option<string>(
            name: "--directory",
            description: "Path to the directory containing split DSM-5 PDF files",
            getDefaultValue: () => Path.Combine(Directory.GetCurrentDirectory(), "dsm", "single-pages"));
        directoryPathOption.AddAlias("-d");
        
        var filePatternOption = new Option<string>(
            name: "--pattern",
            description: "File pattern to match (e.g., 'dsm5_*.pdf')",
            getDefaultValue: () => "dsm5_*.pdf");
        filePatternOption.AddAlias("-p");
        
        var maxFilesOption = new Option<int?>(
            name: "--max-files",
            description: "Maximum number of files to process (for testing)",
            getDefaultValue: () => null);
        maxFilesOption.AddAlias("-m");
        
        var verboseOption = new Option<bool>(
            name: "--verbose",
            description: "Enable verbose logging",
            getDefaultValue: () => false);
        verboseOption.AddAlias("-v");

        dsm5Command.AddOption(directoryPathOption);
        dsm5Command.AddOption(filePatternOption);
        dsm5Command.AddOption(maxFilesOption);
        dsm5Command.AddOption(verboseOption);

        dsm5Command.SetHandler(async (directoryPath, filePattern, maxFiles, verbose) =>
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
            await importer.ImportBatchAsync(directoryPath, filePattern, maxFiles);
        }, directoryPathOption, filePatternOption, maxFilesOption, verboseOption);

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

    public async Task ImportBatchAsync(string directoryPath, string filePattern, int? maxFiles)
    {
        try
        {
            WriteHeader("DSM-5 Data Import Tool - Batch Processing");
            WriteInfo($"Directory: {directoryPath}");
            WriteInfo($"File Pattern: {filePattern}");
            if (maxFiles.HasValue)
            {
                WriteInfo($"Max Files: {maxFiles.Value}");
            }
            WriteInfo($"Mode: Direct Azure Content Understanding (no Function timeout)");
            System.Console.WriteLine();

            // Step 1: Validate prerequisites and get PDF files
            var pdfFiles = ValidateDirectoryAndGetFiles(directoryPath, filePattern, maxFiles);

            // Step 2: Check system status
            await CheckSystemStatusAsync();

            // Step 3: Process each PDF file
            await ProcessPdfBatchAsync(pdfFiles);

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

    private List<string> ValidateDirectoryAndGetFiles(string directoryPath, string filePattern, int? maxFiles)
    {
        WriteStep("Step 1/4: Validating directory and discovering PDF files");

        // Check directory exists
        if (!Directory.Exists(directoryPath))
        {
            throw new DirectoryNotFoundException($"Directory not found at: {directoryPath}");
        }

        WriteSuccess($"Directory found: {directoryPath}");

        // Get all PDF files matching the pattern
        var allFiles = Directory.GetFiles(directoryPath, filePattern, SearchOption.TopDirectoryOnly)
            .OrderBy(f => f)
            .ToList();

        if (allFiles.Count == 0)
        {
            throw new InvalidOperationException($"No PDF files found matching pattern '{filePattern}' in {directoryPath}");
        }

        // Limit files if maxFiles is specified
        var filesToProcess = maxFiles.HasValue 
            ? allFiles.Take(maxFiles.Value).ToList() 
            : allFiles;

        WriteSuccess($"Found {allFiles.Count} PDF files");
        if (maxFiles.HasValue && filesToProcess.Count < allFiles.Count)
        {
            WriteInfo($"  Processing first {filesToProcess.Count} files (limited by --max-files)");
        }
        else
        {
            WriteInfo($"  Processing all {filesToProcess.Count} files");
        }

        // Calculate total size
        long totalSize = filesToProcess.Sum(f => new FileInfo(f).Length);
        WriteInfo($"  Total size: {FormatFileSize(totalSize)}");

        WriteVerbose("Sample files:");
        foreach (var file in filesToProcess.Take(5))
        {
            WriteVerbose($"  • {Path.GetFileName(file)}");
        }
        if (filesToProcess.Count > 5)
        {
            WriteVerbose($"  ... and {filesToProcess.Count - 5} more");
        }

        System.Console.WriteLine();
        return filesToProcess;
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

    private async Task ProcessPdfBatchAsync(List<string> pdfFiles)
    {
        WriteStep("Step 3/4: Processing split DSM-5 PDF files");
        WriteInfo($"Processing {pdfFiles.Count} diagnostic PDF files...");
        WriteWarning("Each file contains a single diagnostic and will be processed individually.");
        System.Console.WriteLine();

        int successCount = 0;
        int failureCount = 0;
        var totalStartTime = DateTime.UtcNow;
        var failedFiles = new List<(string FileName, string Error)>();

        for (int i = 0; i < pdfFiles.Count; i++)
        {
            var pdfPath = pdfFiles[i];
            var fileName = Path.GetFileName(pdfPath);
            
            try
            {
                WriteInfo($"[{i + 1}/{pdfFiles.Count}] Processing: {fileName}");

                // Read and encode PDF
                byte[] pdfBytes = await File.ReadAllBytesAsync(pdfPath);
                string pdfBase64 = Convert.ToBase64String(pdfBytes);
                
                WriteVerbose($"  Size: {FormatFileSize(pdfBytes.Length)}");

                var fileStartTime = DateTime.UtcNow;

                // Call DSM5DataService - no page ranges needed since each file is a single diagnostic
                var result = await _dsm5Service.ExtractDiagnosticCriteriaAsync(
                    pdfUrl: null,
                    pdfBase64: pdfBase64,
                    pageRanges: null, // Single-page PDF, no ranges needed
                    autoUpload: true);

                var elapsed = DateTime.UtcNow - fileStartTime;

                if (result.Success)
                {
                    WriteSuccess($"  ✓ Extracted in {elapsed.TotalSeconds:F1}s - Found {result.ExtractedConditions?.Count ?? 0} condition(s)");
                    successCount++;
                }
                else
                {
                    WriteError($"  ✗ Extraction failed: {result.ErrorMessage}");
                    failedFiles.Add((fileName, result.ErrorMessage ?? "Unknown error"));
                    failureCount++;
                }
            }
            catch (Exception ex)
            {
                WriteError($"  ✗ Error processing file: {ex.Message}");
                failedFiles.Add((fileName, ex.Message));
                failureCount++;
            }

            System.Console.WriteLine();

            // Add a small delay between files to avoid overwhelming the API
            if (i < pdfFiles.Count - 1)
            {
                await Task.Delay(500);
            }
        }

        var totalElapsed = DateTime.UtcNow - totalStartTime;

        // Summary
        WriteStep("Batch Processing Summary");
        WriteSuccess($"Successfully processed: {successCount}/{pdfFiles.Count}");
        if (failureCount > 0)
        {
            WriteError($"Failed: {failureCount}/{pdfFiles.Count}");
        }
        WriteInfo($"Total processing time: {totalElapsed.TotalMinutes:F1} minutes");
        WriteInfo($"Average per file: {totalElapsed.TotalSeconds / pdfFiles.Count:F1}s");

        // Show failed files if any
        if (failedFiles.Any())
        {
            System.Console.WriteLine();
            WriteWarning("Failed files:");
            foreach (var (fileName, error) in failedFiles)
            {
                WriteError($"  • {fileName}: {error}");
            }
        }

        System.Console.WriteLine();

        if (failureCount > 0 && successCount == 0)
        {
            throw new InvalidOperationException($"All {failureCount} files failed to process");
        }

        if (failureCount > 0)
        {
            WriteWarning($"Completed with {failureCount} failures. {successCount} files were processed successfully.");
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
