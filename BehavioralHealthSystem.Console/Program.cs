using BehavioralHealthSystem.Console.Models;
using BehavioralHealthSystem.Console.Services;

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

        // Progress status command
        var statusCommand = new Command("import-status", "Show DSM-5 import progress status");
        statusCommand.SetHandler(() =>
        {
            var progressFilePath = Path.Combine(Directory.GetCurrentDirectory(), "dsm5-import-progress.json");
            
            if (!File.Exists(progressFilePath))
            {
                System.Console.ForegroundColor = ConsoleColor.Yellow;
                System.Console.WriteLine("No import progress file found.");
                System.Console.ResetColor();
                System.Console.WriteLine("Either no import has been started, or the last import completed successfully.");
                return Task.CompletedTask;
            }

            try
            {
                var json = File.ReadAllText(progressFilePath);
                var progress = JsonSerializer.Deserialize<ImportProgress>(json);
                
                if (progress != null)
                {
                    System.Console.ForegroundColor = ConsoleColor.Cyan;
                    System.Console.WriteLine("==================================================");
                    System.Console.WriteLine("  DSM-5 Import Progress Status");
                    System.Console.WriteLine("==================================================");
                    System.Console.ResetColor();
                    System.Console.WriteLine();
                    
                    System.Console.WriteLine($"Started:        {progress.StartedAt:g}");
                    System.Console.WriteLine($"Last Updated:   {progress.LastUpdatedAt?.ToString("g") ?? "Never"}");
                    System.Console.WriteLine($"Total Files:    {progress.TotalFiles}");
                    
                    System.Console.ForegroundColor = ConsoleColor.Green;
                    System.Console.WriteLine($"Completed:      {progress.CompletedFiles} ({(progress.TotalFiles > 0 ? (progress.CompletedFiles * 100.0 / progress.TotalFiles) : 0):F1}%)");
                    System.Console.ResetColor();
                    
                    if (progress.FailedFiles > 0)
                    {
                        System.Console.ForegroundColor = ConsoleColor.Red;
                        System.Console.WriteLine($"Failed:         {progress.FailedFiles}");
                        System.Console.ResetColor();
                    }
                    
                    var remaining = progress.TotalFiles - progress.CompletedFiles - progress.FailedFiles;
                    if (remaining > 0)
                    {
                        System.Console.ForegroundColor = ConsoleColor.Yellow;
                        System.Console.WriteLine($"Remaining:      {remaining}");
                        System.Console.ResetColor();
                    }
                    
                    System.Console.WriteLine();
                    System.Console.WriteLine($"Progress file:  {progressFilePath}");
                    
                    if (progress.FailedFilesList.Any())
                    {
                        System.Console.WriteLine();
                        System.Console.ForegroundColor = ConsoleColor.Yellow;
                        System.Console.WriteLine("Failed files:");
                        System.Console.ResetColor();
                        foreach (var failed in progress.FailedFilesList.Take(10))
                        {
                            System.Console.ForegroundColor = ConsoleColor.Red;
                            System.Console.WriteLine($"  • {failed.FileName}");
                            System.Console.ResetColor();
                            System.Console.ForegroundColor = ConsoleColor.Gray;
                            System.Console.WriteLine($"    {failed.Error}");
                            System.Console.ResetColor();
                        }
                        if (progress.FailedFilesList.Count > 10)
                        {
                            System.Console.WriteLine($"  ... and {progress.FailedFilesList.Count - 10} more");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                System.Console.ForegroundColor = ConsoleColor.Red;
                System.Console.WriteLine($"Error reading progress file: {ex.Message}");
                System.Console.ResetColor();
            }
            
            return Task.CompletedTask;
        });
        rootCommand.AddCommand(statusCommand);

        // Reset progress command
        var resetCommand = new Command("import-reset", "Reset DSM-5 import progress (start fresh)");
        resetCommand.SetHandler(() =>
        {
            var progressFilePath = Path.Combine(Directory.GetCurrentDirectory(), "dsm5-import-progress.json");
            
            if (!File.Exists(progressFilePath))
            {
                System.Console.ForegroundColor = ConsoleColor.Yellow;
                System.Console.WriteLine("No progress file found - nothing to reset.");
                System.Console.ResetColor();
                return Task.CompletedTask;
            }

            try
            {
                File.Delete(progressFilePath);
                System.Console.ForegroundColor = ConsoleColor.Green;
                System.Console.WriteLine("✓ Import progress has been reset.");
                System.Console.ResetColor();
                System.Console.WriteLine("Next import will start from the beginning.");
            }
            catch (Exception ex)
            {
                System.Console.ForegroundColor = ConsoleColor.Red;
                System.Console.WriteLine($"✗ Error resetting progress: {ex.Message}");
                System.Console.ResetColor();
            }
            
            return Task.CompletedTask;
        });
        rootCommand.AddCommand(resetCommand);

        // Retry failed files command
        var retryCommand = new Command("import-retry", "Retry processing only the failed files from previous import");
        
        var retryDirectoryOption = new Option<string>(
            name: "--directory",
            description: "Path to the directory containing split DSM-5 PDF files",
            getDefaultValue: () => Path.Combine(Directory.GetCurrentDirectory(), "dsm", "single-pages"));
        retryDirectoryOption.AddAlias("-d");
        
        var retryVerboseOption = new Option<bool>(
            name: "--verbose",
            description: "Enable verbose logging",
            getDefaultValue: () => false);
        retryVerboseOption.AddAlias("-v");

        retryCommand.AddOption(retryDirectoryOption);
        retryCommand.AddOption(retryVerboseOption);
        
        retryCommand.SetHandler(async (directoryPath, verbose) =>
        {
            var progressFilePath = Path.Combine(Directory.GetCurrentDirectory(), "dsm5-import-progress.json");
            
            if (!File.Exists(progressFilePath))
            {
                System.Console.ForegroundColor = ConsoleColor.Yellow;
                System.Console.WriteLine("No import progress file found.");
                System.Console.ResetColor();
                System.Console.WriteLine("Run 'import-dsm5' to start a new import.");
                return;
            }

            try
            {
                var json = File.ReadAllText(progressFilePath);
                var progress = JsonSerializer.Deserialize<ImportProgress>(json);
                
                if (progress?.FailedFilesList.Any() != true)
                {
                    System.Console.ForegroundColor = ConsoleColor.Green;
                    System.Console.WriteLine("✓ No failed files to retry!");
                    System.Console.ResetColor();
                    return;
                }

                System.Console.ForegroundColor = ConsoleColor.Cyan;
                System.Console.WriteLine($"Found {progress.FailedFilesList.Count} failed files to retry:");
                System.Console.ResetColor();
                foreach (var failed in progress.FailedFilesList)
                {
                    System.Console.WriteLine($"  • {failed.FileName}: {failed.Error}");
                }
                System.Console.WriteLine();

                // Build configuration and services
                var configuration = new ConfigurationBuilder()
                    .SetBasePath(Directory.GetCurrentDirectory())
                    .AddJsonFile("appsettings.json", optional: true)
                    .AddEnvironmentVariables()
                    .Build();

                var services = new ServiceCollection();
                services.AddLogging(builder => builder.AddConsole().SetMinimumLevel(verbose ? LogLevel.Debug : LogLevel.Information));
                services.AddSingleton<IConfiguration>(configuration);
                services.AddSingleton<IAzureContentUnderstandingService, AzureContentUnderstandingService>();
                services.AddSingleton<IDSM5DataService, DSM5DataService>();

                var serviceProvider = services.BuildServiceProvider();
                var dsm5Service = serviceProvider.GetRequiredService<IDSM5DataService>();

                // Create list of failed file paths
                var failedFilePaths = progress.FailedFilesList
                    .Select(f => Path.Combine(directoryPath, f.FileName))
                    .Where(File.Exists)
                    .ToList();

                if (!failedFilePaths.Any())
                {
                    System.Console.ForegroundColor = ConsoleColor.Red;
                    System.Console.WriteLine("✗ None of the failed files found in the specified directory.");
                    System.Console.ResetColor();
                    System.Console.WriteLine($"Directory: {directoryPath}");
                    return;
                }

                // Clear failed files from progress (they'll be re-added if they fail again)
                progress.FailedFilesList.Clear();
                progress.FailedFiles = 0;
                File.WriteAllText(progressFilePath, JsonSerializer.Serialize(progress, new JsonSerializerOptions { WriteIndented = true }));

                var importer = new DSM5Importer(dsm5Service, verbose);
                await importer.RetryFailedFilesAsync(failedFilePaths);
            }
            catch (Exception ex)
            {
                System.Console.ForegroundColor = ConsoleColor.Red;
                System.Console.WriteLine($"Error during retry: {ex.Message}");
                System.Console.ResetColor();
            }
        }, retryDirectoryOption, retryVerboseOption);
        
        rootCommand.AddCommand(retryCommand);

        return await rootCommand.InvokeAsync(args);
    }
}
