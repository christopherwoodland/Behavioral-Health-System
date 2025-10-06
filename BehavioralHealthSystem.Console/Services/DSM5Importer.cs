using BehavioralHealthSystem.Console.Models;

namespace BehavioralHealthSystem.Console.Services;

/// <summary>
/// Handles DSM-5 data import operations using DSM5DataService directly
/// </summary>
public class DSM5Importer
{
    private readonly IDSM5DataService _dsm5Service;
    private readonly bool _verbose;
    private readonly string _progressFilePath;
    private ImportProgress _progress;

    public DSM5Importer(IDSM5DataService dsm5Service, bool verbose)
    {
        _dsm5Service = dsm5Service ?? throw new ArgumentNullException(nameof(dsm5Service));
        _verbose = verbose;
        _progressFilePath = Path.Combine(Directory.GetCurrentDirectory(), "dsm5-import-progress.json");
        _progress = LoadOrCreateProgress();
    }

    private ImportProgress LoadOrCreateProgress()
    {
        if (File.Exists(_progressFilePath))
        {
            try
            {
                var json = File.ReadAllText(_progressFilePath);
                var progress = JsonSerializer.Deserialize<ImportProgress>(json);
                if (progress != null)
                {
                    WriteInfo($"Resuming from previous import session (started {progress.StartedAt:g})");
                    WriteInfo($"  Previously completed: {progress.CompletedFiles}/{progress.TotalFiles} files");
                    if (progress.FailedFiles > 0)
                    {
                        WriteWarning($"  Previously failed: {progress.FailedFiles} files");
                    }
                    System.Console.WriteLine();
                    return progress;
                }
            }
            catch (Exception ex)
            {
                WriteWarning($"Could not load progress file: {ex.Message}");
                WriteInfo("Starting fresh import...");
            }
        }

        return new ImportProgress
        {
            StartedAt = DateTime.UtcNow
        };
    }

    private void SaveProgress()
    {
        try
        {
            _progress.LastUpdatedAt = DateTime.UtcNow;
            var json = JsonSerializer.Serialize(_progress, new JsonSerializerOptions 
            { 
                WriteIndented = true 
            });
            File.WriteAllText(_progressFilePath, json);
            
            if (_verbose)
            {
                WriteVerbose($"Progress saved: {_progress.CompletedFiles}/{_progress.TotalFiles} completed");
            }
        }
        catch (Exception ex)
        {
            WriteWarning($"Could not save progress: {ex.Message}");
        }
    }

    private void ClearProgress()
    {
        try
        {
            if (File.Exists(_progressFilePath))
            {
                File.Delete(_progressFilePath);
                WriteSuccess("Import completed - progress file cleared");
            }
        }
        catch (Exception ex)
        {
            WriteWarning($"Could not delete progress file: {ex.Message}");
        }
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

    public async Task RetryFailedFilesAsync(List<string> failedFilePaths)
    {
        try
        {
            WriteHeader("DSM-5 Data Import Tool - Retry Failed Files");
            WriteInfo($"Retrying {failedFilePaths.Count} failed files");
            WriteInfo($"Mode: Direct Azure Content Understanding (no Function timeout)");
            System.Console.WriteLine();

            // Process each failed file (skip filtering for retry)
            await ProcessPdfBatchAsync(failedFilePaths, isRetry: true);

            WriteStep("Final Status Check");
            await VerifyDataAsync();

            WriteSuccess("Failed files retry completed!");
        }
        catch (Exception ex)
        {
            WriteError($"Failed files retry failed: {ex.Message}");
            throw;
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

    private async Task ProcessPdfBatchAsync(List<string> pdfFiles, bool isRetry = false)
    {
        WriteStep("Step 3/4: Processing split DSM-5 PDF files");
        
        // Initialize progress if this is a new run
        if (_progress.TotalFiles == 0)
        {
            _progress.TotalFiles = pdfFiles.Count;
            SaveProgress();
        }

        // Filter out already completed files
        var pendingFiles = pdfFiles
            .Where(f => !_progress.CompletedFileNames.Contains(Path.GetFileName(f)))
            .ToList();

        // For regular import (not retry), also filter out files that are already in failed list to avoid double processing
        if (!isRetry)
        {
            var failedFileNames = _progress.FailedFilesList.Select(ff => ff.FileName).ToHashSet();
            pendingFiles = pendingFiles
                .Where(f => !failedFileNames.Contains(Path.GetFileName(f)))
                .ToList();
        }

        if (pendingFiles.Count < pdfFiles.Count)
        {
            var skippedCount = pdfFiles.Count - pendingFiles.Count;
            WriteSuccess($"Skipping {skippedCount} already processed files (completed or failed)");
        }

        WriteInfo($"Processing {pendingFiles.Count} diagnostic PDF files...");
        WriteWarning("Each file contains a single diagnostic and will be processed individually.");
        System.Console.WriteLine();

        int successCount = _progress.CompletedFiles;
        int failureCount = _progress.FailedFiles;
        var totalStartTime = DateTime.UtcNow;
        var sessionFailedFiles = new List<(string FileName, string Error)>();

        for (int i = 0; i < pendingFiles.Count; i++)
        {
            var pdfPath = pendingFiles[i];
            var fileName = Path.GetFileName(pdfPath);
            var overallProgress = successCount + failureCount + 1;
            
            try
            {
                WriteInfo($"[{overallProgress}/{pdfFiles.Count}] Processing: {fileName}");

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
                    
                    // Track completed file
                    _progress.CompletedFiles = successCount;
                    _progress.CompletedFileNames.Add(fileName);
                    SaveProgress();
                }
                else
                {
                    WriteError($"  ✗ Extraction failed: {result.ErrorMessage}");
                    var errorMsg = result.ErrorMessage ?? "Unknown error";
                    sessionFailedFiles.Add((fileName, errorMsg));
                    failureCount++;
                    
                    // Track failed file
                    _progress.FailedFiles = failureCount;
                    _progress.FailedFilesList.Add(new FailedFileInfo
                    {
                        FileName = fileName,
                        Error = errorMsg,
                        FailedAt = DateTime.UtcNow
                    });
                    SaveProgress();
                }
            }
            catch (Exception ex)
            {
                WriteError($"  ✗ Error processing file: {ex.Message}");
                sessionFailedFiles.Add((fileName, ex.Message));
                failureCount++;
                
                // Track failed file
                _progress.FailedFiles = failureCount;
                _progress.FailedFilesList.Add(new FailedFileInfo
                {
                    FileName = fileName,
                    Error = ex.Message,
                    FailedAt = DateTime.UtcNow
                });
                SaveProgress();
            }

            System.Console.WriteLine();

            // Add a delay between files to avoid overwhelming the API
            // Increased from 500ms to 2 seconds for better rate limiting
            if (i < pendingFiles.Count - 1)
            {
                await Task.Delay(2000);
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
        if (pendingFiles.Count > 0)
        {
            WriteInfo($"Average per file (this session): {totalElapsed.TotalSeconds / pendingFiles.Count:F1}s");
        }

        // Show failed files from this session if any
        if (sessionFailedFiles.Any())
        {
            System.Console.WriteLine();
            WriteWarning("Failed files (this session):");
            foreach (var (fileName, error) in sessionFailedFiles)
            {
                WriteError($"  • {fileName}: {error}");
            }
        }

        // Show all failed files if there are any from previous sessions
        if (_progress.FailedFilesList.Any() && sessionFailedFiles.Count < _progress.FailedFilesList.Count)
        {
            System.Console.WriteLine();
            WriteWarning("All failed files (including previous sessions):");
            foreach (var failedFile in _progress.FailedFilesList)
            {
                WriteError($"  • {failedFile.FileName}: {failedFile.Error}");
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
            WriteInfo($"Progress saved to: {_progressFilePath}");
            WriteInfo("To retry failed files or continue, run the command again.");
        }
        else if (successCount == pdfFiles.Count)
        {
            // All files completed successfully - clear progress file
            ClearProgress();
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
