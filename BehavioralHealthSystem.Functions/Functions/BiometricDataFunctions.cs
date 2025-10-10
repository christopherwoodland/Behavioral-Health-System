using Microsoft.Azure.Functions.Worker.Http;
using BehavioralHealthSystem.Helpers.Services.Interfaces;

namespace BehavioralHealthSystem.Functions.Functions;

/// <summary>
/// Azure Functions for managing user biometric data.
/// Provides endpoints for checking existence, retrieving, and saving biometric data collected by the Matron agent.
/// </summary>
public class BiometricDataFunctions
{
    private readonly IBiometricDataService _biometricDataService;
    private readonly IValidator<UserBiometricData> _validator;
    private readonly ILogger<BiometricDataFunctions> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="BiometricDataFunctions"/> class.
    /// </summary>
    /// <param name="biometricDataService">The biometric data service.</param>
    /// <param name="validator">The biometric data validator.</param>
    /// <param name="logger">The logger instance.</param>
    /// <exception cref="ArgumentNullException">Thrown when any required dependency is null.</exception>
    public BiometricDataFunctions(
        IBiometricDataService biometricDataService,
        IValidator<UserBiometricData> validator,
        ILogger<BiometricDataFunctions> logger)
    {
        _biometricDataService = biometricDataService ?? throw new ArgumentNullException(nameof(biometricDataService));
        _validator = validator ?? throw new ArgumentNullException(nameof(validator));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Checks if biometric data exists for a user.
    /// Used by Tars orchestration to determine if Matron agent needs to be called.
    /// </summary>
    /// <param name="req">The HTTP request.</param>
    /// <param name="userId">The user identifier from the route.</param>
    /// <returns>HTTP response indicating whether biometric data exists.</returns>
    [Function("CheckBiometricDataExists")]
    public async Task<HttpResponseData> CheckBiometricDataExists(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "biometric/{userId}/exists")] HttpRequestData req,
        string userId)
    {
        _logger.LogInformation("Checking biometric data existence for user: {UserId}", userId);

        try
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "User ID is required"
                });
                return badRequest;
            }

            bool exists = await _biometricDataService.UserBiometricDataExistsAsync(userId);

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteAsJsonAsync(new
            {
                success = true,
                userId,
                exists,
                message = exists
                    ? "Biometric data exists for this user"
                    : "No biometric data found for this user"
            });

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking biometric data existence for user: {UserId}", userId);

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteAsJsonAsync(new
            {
                success = false,
                message = "An error occurred while checking biometric data",
                error = ex.Message
            });
            return errorResponse;
        }
    }

    /// <summary>
    /// Retrieves biometric data for a user.
    /// </summary>
    /// <param name="req">The HTTP request.</param>
    /// <param name="userId">The user identifier from the route.</param>
    /// <returns>HTTP response containing the user's biometric data.</returns>
    [Function("GetBiometricData")]
    public async Task<HttpResponseData> GetBiometricData(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "biometric/{userId}")] HttpRequestData req,
        string userId)
    {
        _logger.LogInformation("Retrieving biometric data for user: {UserId}", userId);

        try
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "User ID is required"
                });
                return badRequest;
            }

            var biometricData = await _biometricDataService.GetUserBiometricDataAsync(userId);

            if (biometricData == null)
            {
                var notFound = req.CreateResponse(HttpStatusCode.NotFound);
                await notFound.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Biometric data not found for this user"
                });
                return notFound;
            }

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteAsJsonAsync(new
            {
                success = true,
                data = biometricData
            });

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving biometric data for user: {UserId}", userId);

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteAsJsonAsync(new
            {
                success = false,
                message = "An error occurred while retrieving biometric data",
                error = ex.Message
            });
            return errorResponse;
        }
    }

    /// <summary>
    /// Saves or updates biometric data for a user.
    /// Used by the Matron agent after collecting user information.
    /// </summary>
    /// <param name="req">The HTTP request containing biometric data.</param>
    /// <returns>HTTP response indicating success or failure.</returns>
    [Function("SaveBiometricData")]
    public async Task<HttpResponseData> SaveBiometricData(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "biometric")] HttpRequestData req)
    {
        _logger.LogInformation("Saving biometric data");

        try
        {
            // Parse request body
            var requestBody = await req.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(requestBody))
            {
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Request body is required"
                });
                return badRequest;
            }

            var biometricData = JsonSerializer.Deserialize<UserBiometricData>(requestBody, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (biometricData == null)
            {
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Invalid biometric data format"
                });
                return badRequest;
            }

            // Validate the data
            var validationResult = await _validator.ValidateAsync(biometricData);
            if (!validationResult.IsValid)
            {
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Validation failed",
                    errors = validationResult.Errors.Select(e => new
                    {
                        field = e.PropertyName,
                        error = e.ErrorMessage
                    })
                });
                return badRequest;
            }

            // Save the data
            await _biometricDataService.SaveUserBiometricDataAsync(biometricData);

            _logger.LogInformation(
                "Successfully saved biometric data for user: {UserId}",
                biometricData.UserId);

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteAsJsonAsync(new
            {
                success = true,
                message = "Biometric data saved successfully",
                userId = biometricData.UserId,
                timestamp = biometricData.Timestamp
            });

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving biometric data");

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteAsJsonAsync(new
            {
                success = false,
                message = "An error occurred while saving biometric data",
                error = ex.Message
            });
            return errorResponse;
        }
    }

    /// <summary>
    /// Deletes biometric data for a user.
    /// </summary>
    /// <param name="req">The HTTP request.</param>
    /// <param name="userId">The user identifier from the route.</param>
    /// <returns>HTTP response indicating success or failure.</returns>
    [Function("DeleteBiometricData")]
    public async Task<HttpResponseData> DeleteBiometricData(
        [HttpTrigger(AuthorizationLevel.Function, "delete", Route = "biometric/{userId}")] HttpRequestData req,
        string userId)
    {
        _logger.LogInformation("Deleting biometric data for user: {UserId}", userId);

        try
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "User ID is required"
                });
                return badRequest;
            }

            bool deleted = await _biometricDataService.DeleteUserBiometricDataAsync(userId);

            var statusCode = deleted ? HttpStatusCode.OK : HttpStatusCode.NotFound;
            var response = req.CreateResponse(statusCode);
            await response.WriteAsJsonAsync(new
            {
                success = deleted,
                message = deleted
                    ? "Biometric data deleted successfully"
                    : "No biometric data found to delete"
            });

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting biometric data for user: {UserId}", userId);

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteAsJsonAsync(new
            {
                success = false,
                message = "An error occurred while deleting biometric data",
                error = ex.Message
            });
            return errorResponse;
        }
    }
}
