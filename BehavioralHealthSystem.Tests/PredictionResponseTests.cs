using BehavioralHealthSystem.Models;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class PredictionResponseTests
    {
        [TestMethod]
        public void PredictionResponse_Constructor_Succeeds()
        {
            var model = new PredictionResponse();
            Assert.IsNotNull(model);
        }
    }
}
