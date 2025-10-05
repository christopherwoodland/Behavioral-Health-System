namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class PredictionRequestTests
    {
        [TestMethod]
        public void PredictionRequest_Constructor_Succeeds()
        {
            var model = new PredictionRequest();
            Assert.IsNotNull(model);
        }
    }
}
