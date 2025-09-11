using Microsoft.VisualStudio.TestTools.UnitTesting;
using BehavioralHealthSystem.Functions;
using Microsoft.Extensions.Logging;
using BehavioralHealthSystem.Services.Interfaces;
using BehavioralHealthSystem.Services;
using Moq;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class RiskAssessmentFunctionsTests
    {
        [TestMethod]
        public void RiskAssessmentFunctions_Constructor_Succeeds()
        {
            // Arrange
            var loggerMock = new Mock<ILogger<RiskAssessmentFunctions>>();
            var riskAssessmentServiceMock = new Mock<IRiskAssessmentService>();
            var sessionStorageServiceMock = new Mock<ISessionStorageService>();
            
            // Act
            var function = new RiskAssessmentFunctions(
                loggerMock.Object, 
                riskAssessmentServiceMock.Object, 
                sessionStorageServiceMock.Object);
            
            // Assert
            Assert.IsNotNull(function);
        }

        [TestMethod]
        public void RiskAssessmentFunctions_Constructor_ThrowsArgumentNullException_WhenLoggerIsNull()
        {
            // Arrange
            var riskAssessmentServiceMock = new Mock<IRiskAssessmentService>();
            var sessionStorageServiceMock = new Mock<ISessionStorageService>();
            
            // Act & Assert
            Assert.ThrowsException<ArgumentNullException>(() => 
                new RiskAssessmentFunctions(null!, riskAssessmentServiceMock.Object, sessionStorageServiceMock.Object));
        }

        [TestMethod]
        public void RiskAssessmentFunctions_Constructor_ThrowsArgumentNullException_WhenRiskAssessmentServiceIsNull()
        {
            // Arrange
            var loggerMock = new Mock<ILogger<RiskAssessmentFunctions>>();
            var sessionStorageServiceMock = new Mock<ISessionStorageService>();
            
            // Act & Assert
            Assert.ThrowsException<ArgumentNullException>(() => 
                new RiskAssessmentFunctions(loggerMock.Object, null!, sessionStorageServiceMock.Object));
        }

        [TestMethod]
        public void RiskAssessmentFunctions_Constructor_ThrowsArgumentNullException_WhenSessionStorageServiceIsNull()
        {
            // Arrange
            var loggerMock = new Mock<ILogger<RiskAssessmentFunctions>>();
            var riskAssessmentServiceMock = new Mock<IRiskAssessmentService>();
            
            // Act & Assert
            Assert.ThrowsException<ArgumentNullException>(() => 
                new RiskAssessmentFunctions(loggerMock.Object, riskAssessmentServiceMock.Object, null!));
        }
    }
}