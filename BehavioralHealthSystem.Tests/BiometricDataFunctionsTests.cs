using Moq;
using Microsoft.Extensions.Logging;
using BehavioralHealthSystem.Helpers.Services.Interfaces;
using BehavioralHealthSystem.Functions.Functions;
using BehavioralHealthSystem.Helpers.Models;
using FluentValidation;

namespace BehavioralHealthSystem.Tests;

[TestClass]
public class BiometricDataFunctionsTests
{
    private BiometricDataFunctions _functions = null!;
    private Mock<IBiometricDataService> _mockBiometricDataService = null!;
    private Mock<IValidator<UserBiometricData>> _mockValidator = null!;
    private Mock<ILogger<BiometricDataFunctions>> _mockLogger = null!;

    [TestInitialize]
    public void Setup()
    {
        _mockBiometricDataService = new Mock<IBiometricDataService>();
        _mockValidator = new Mock<IValidator<UserBiometricData>>();
        _mockLogger = new Mock<ILogger<BiometricDataFunctions>>();

        _functions = new BiometricDataFunctions(
            _mockBiometricDataService.Object,
            _mockValidator.Object,
            _mockLogger.Object);
    }

    [TestMethod]
    public void Constructor_WithValidParameters_InitializesSuccessfully()
    {
        // Act & Assert - Constructor should not throw
        var functions = new BiometricDataFunctions(
            _mockBiometricDataService.Object,
            _mockValidator.Object,
            _mockLogger.Object);

        Assert.IsNotNull(functions);
    }

    [TestMethod]
    public void Constructor_WithNullBiometricDataService_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.ThrowsException<ArgumentNullException>(() =>
            new BiometricDataFunctions(null!, _mockValidator.Object, _mockLogger.Object));
    }

    [TestMethod]
    public void Constructor_WithNullValidator_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.ThrowsException<ArgumentNullException>(() =>
            new BiometricDataFunctions(_mockBiometricDataService.Object, null!, _mockLogger.Object));
    }

    [TestMethod]
    public void Constructor_WithNullLogger_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.ThrowsException<ArgumentNullException>(() =>
            new BiometricDataFunctions(_mockBiometricDataService.Object, _mockValidator.Object, null!));
    }

    [TestMethod]
    public void Constructor_WithAllNullParameters_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.ThrowsException<ArgumentNullException>(() =>
            new BiometricDataFunctions(null!, null!, null!));
    }

    [TestMethod]
    public void Constructor_VerifyAllDependenciesInjected()
    {
        // Arrange & Act
        var functions = new BiometricDataFunctions(
            _mockBiometricDataService.Object,
            _mockValidator.Object,
            _mockLogger.Object);

        // Assert - Constructor completes successfully with all dependencies
        Assert.IsNotNull(functions);

        // Verify dependencies were accepted (no exceptions thrown)
        _mockBiometricDataService.VerifyNoOtherCalls();
        _mockValidator.VerifyNoOtherCalls();
        _mockLogger.VerifyNoOtherCalls();
    }
}
