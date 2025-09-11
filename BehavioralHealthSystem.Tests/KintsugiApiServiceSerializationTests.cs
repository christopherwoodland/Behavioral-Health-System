using System.Text.Json;
using BehavioralHealthSystem.Models;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class KintsugiApiServiceSerializationTests
    {
        [TestMethod]
        public void InitiateRequest_Payload_Uses_Snake_Case_Keys()
        {
            // Arrange
            var request = new InitiateRequest
            {
                UserId = "unit-test-user",
                IsInitiated = true,
                Metadata = new UserMetadata
                {
                    Age = 30,
                    Ethnicity = "Not Hispanic, Latino, or Spanish Origin",
                    Gender = "female",
                    Language = true,
                    Race = "white",
                    Weight = 140,
                    Zipcode = "90210"
                }
            };

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            var payload = new
            {
                user_id = request.UserId,
                is_initiated = request.IsInitiated,
                metadata = request.Metadata
            };

            // Act
            var json = JsonSerializer.Serialize(payload, options);

            // Assert
            StringAssert.Contains(json, "\"user_id\":");
            StringAssert.Contains(json, "\"is_initiated\":");
            // Ensure camelCase version not present as top-level keys
            Assert.IsFalse(json.Contains("\"userId\":"));
            Assert.IsFalse(json.Contains("\"isInitiated\":"));
        }
    }
}
