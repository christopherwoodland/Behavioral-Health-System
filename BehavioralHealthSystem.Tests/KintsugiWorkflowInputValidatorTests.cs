using Microsoft.VisualStudio.TestTools.UnitTesting;
using BehavioralHealthSystem.Models;
using BehavioralHealthSystem.Validators;
using FluentValidation;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class KintsugiWorkflowInputValidatorTests
    {
        private KintsugiWorkflowInputValidator _validator = null!;

        [TestInitialize]
        public void Setup()
        {
            _validator = new KintsugiWorkflowInputValidator();
        }

        private UserMetadata CreateValidUserMetadata()
        {
            return new UserMetadata
            {
                Age = 25,
                Gender = "male",
                Ethnicity = "Not Hispanic, Latino, or Spanish Origin",
                Race = "white",
                Weight = 150,
                Zipcode = "12345",
                Language = true
            };
        }

        [TestMethod]
        public void Validator_WithValidAudioData_ShouldPass()
        {
            // Arrange
            var input = new KintsugiWorkflowInput
            {
                UserId = "test-user",
                Metadata = CreateValidUserMetadata(),
                AudioData = new byte[2048] // 2KB - within valid range
            };

            // Act
            var result = _validator.Validate(input);

            // Assert
            Assert.IsTrue(result.IsValid, "Validation should pass with valid audio data");
        }

        [TestMethod]
        public void Validator_WithValidUrlAndFileName_ShouldPass()
        {
            // Arrange
            var input = new KintsugiWorkflowInput
            {
                UserId = "test-user",
                Metadata = CreateValidUserMetadata(),
                AudioFileUrl = "https://example.blob.core.windows.net/audio/test.wav",
                AudioFileName = "test.wav"
            };

            // Act
            var result = _validator.Validate(input);

            // Assert
            Assert.IsTrue(result.IsValid, "Validation should pass with valid URL and filename");
        }

        [TestMethod]
        public void Validator_WithBothAudioDataAndUrl_ShouldPass()
        {
            // Arrange - Both provided (system should handle intelligently)
            var input = new KintsugiWorkflowInput
            {
                UserId = "test-user",
                Metadata = CreateValidUserMetadata(),
                AudioData = new byte[2048], // 2KB
                AudioFileUrl = "https://example.blob.core.windows.net/audio/test.wav",
                AudioFileName = "test.wav"
            };

            // Act
            var result = _validator.Validate(input);

            // Assert
            Assert.IsTrue(result.IsValid, "Validation should pass when both approaches are provided");
        }

        [TestMethod]
        public void Validator_WithNoAudioInput_ShouldFail()
        {
            // Arrange
            var input = new KintsugiWorkflowInput
            {
                UserId = "test-user",
                Metadata = CreateValidUserMetadata()
                // No AudioData, AudioFileUrl, or AudioFileName
            };

            // Act
            var result = _validator.Validate(input);

            // Assert
            Assert.IsFalse(result.IsValid, "Validation should fail when no audio input is provided");
            Assert.IsTrue(result.Errors.Any(e => e.ErrorMessage.Contains("Either AudioData or both AudioFileUrl and AudioFileName must be provided")));
        }

        [TestMethod]
        public void Validator_WithOnlyAudioFileUrl_NoFileName_ShouldFail()
        {
            // Arrange
            var input = new KintsugiWorkflowInput
            {
                UserId = "test-user",
                Metadata = CreateValidUserMetadata(),
                AudioFileUrl = "https://example.blob.core.windows.net/audio/test.wav"
                // Missing AudioFileName
            };

            // Act
            var result = _validator.Validate(input);

            // Assert
            Assert.IsFalse(result.IsValid, "Validation should fail when URL is provided without filename");
            Assert.IsTrue(result.Errors.Any(e => e.ErrorMessage.Contains("Either AudioData or both AudioFileUrl and AudioFileName must be provided")));
        }

        [TestMethod]
        public void Validator_WithInvalidUrl_ShouldFail()
        {
            // Arrange
            var input = new KintsugiWorkflowInput
            {
                UserId = "test-user",
                Metadata = CreateValidUserMetadata(),
                AudioFileUrl = "invalid-url",
                AudioFileName = "test.wav"
            };

            // Act
            var result = _validator.Validate(input);

            // Assert
            Assert.IsFalse(result.IsValid, "Validation should fail with invalid URL");
            Assert.IsTrue(result.Errors.Any(e => e.ErrorMessage.Contains("AudioFileUrl must be a valid URL")));
        }

        [TestMethod]
        public void Validator_WithInvalidFileExtension_ShouldFail()
        {
            // Arrange
            var input = new KintsugiWorkflowInput
            {
                UserId = "test-user",
                Metadata = CreateValidUserMetadata(),
                AudioFileUrl = "https://example.blob.core.windows.net/audio/test.txt",
                AudioFileName = "test.txt"
            };

            // Act
            var result = _validator.Validate(input);

            // Assert
            Assert.IsFalse(result.IsValid, "Validation should fail with invalid file extension");
            Assert.IsTrue(result.Errors.Any(e => e.ErrorMessage.Contains("AudioFileName must have a valid audio file extension")));
        }

        [TestMethod]
        public void Validator_WithAudioDataTooSmall_ShouldFail()
        {
            // Arrange
            var input = new KintsugiWorkflowInput
            {
                UserId = "test-user",
                Metadata = CreateValidUserMetadata(),
                AudioData = new byte[500] // Too small (< 1KB)
            };

            // Act
            var result = _validator.Validate(input);

            // Assert
            Assert.IsFalse(result.IsValid, "Validation should fail with audio data too small");
            Assert.IsTrue(result.Errors.Any(e => e.ErrorMessage.Contains("Audio data must be between")));
        }

        [TestMethod]
        public void Validator_WithValidFileExtensions_ShouldPass()
        {
            // Test all valid extensions
            var validExtensions = new[] { ".wav", ".mp3", ".m4a", ".flac" };

            foreach (var extension in validExtensions)
            {
                // Arrange
                var input = new KintsugiWorkflowInput
                {
                    UserId = "test-user",
                    Metadata = CreateValidUserMetadata(),
                    AudioFileUrl = $"https://example.blob.core.windows.net/audio/test{extension}",
                    AudioFileName = $"test{extension}"
                };

                // Act
                var result = _validator.Validate(input);

                // Assert
                Assert.IsTrue(result.IsValid, $"Validation should pass for {extension} extension");
            }
        }

        [TestMethod]
        public void Validator_WithHttpsUrl_ShouldPass()
        {
            // Arrange
            var input = new KintsugiWorkflowInput
            {
                UserId = "test-user",
                Metadata = CreateValidUserMetadata(),
                AudioFileUrl = "https://example.blob.core.windows.net/audio/test.wav",
                AudioFileName = "test.wav"
            };

            // Act
            var result = _validator.Validate(input);

            // Assert
            Assert.IsTrue(result.IsValid, "Validation should pass with HTTPS URL");
        }

        [TestMethod]
        public void Validator_WithHttpUrl_ShouldPass()
        {
            // Arrange
            var input = new KintsugiWorkflowInput
            {
                UserId = "test-user",
                Metadata = CreateValidUserMetadata(),
                AudioFileUrl = "http://example.com/audio/test.wav",
                AudioFileName = "test.wav"
            };

            // Act
            var result = _validator.Validate(input);

            // Assert
            Assert.IsTrue(result.IsValid, "Validation should pass with HTTP URL");
        }
    }
}
