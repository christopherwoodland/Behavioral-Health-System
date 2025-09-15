using BehavioralHealthSystem.Models;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class PredictionResultTests
    {
        [TestMethod]
        public void PredictionResult_Constructor_Succeeds()
        {
            var model = new PredictionResult();
            Assert.IsNotNull(model);
        }
    }
}
