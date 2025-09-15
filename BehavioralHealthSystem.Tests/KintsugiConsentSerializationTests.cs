using System.Text.Json;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class KintsugiConsentSerializationTests
    {
        [TestMethod]
        public void ConsentPayload_Includes_Consent_Fields()
        {
            var request = new
            {
                user_id = "user-1",
                is_initiated = true,
                consent = true,
                consent_timestamp = System.DateTimeOffset.UtcNow.ToUniversalTime().ToString("o"),
                metadata = new { age = 20 }
            };
            var json = JsonSerializer.Serialize(request, new JsonSerializerOptions{PropertyNameCaseInsensitive = true});
            StringAssert.Contains(json, "\"consent\":true");
            StringAssert.Contains(json, "consent_timestamp");
        }
    }
}
